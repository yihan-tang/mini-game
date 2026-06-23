/**
 * LeagueSimulator 38轮联赛模拟算法
 *
 * 核心胜负规则:
 * 1. 基础胜率 = 我方总战力 / (我方战力 + AI对手战力)
 * 2. 防线总防守 < 320 → 平局概率 +25%；中场拦截总值 < 280 → 平局概率 +20%
 * 3. 每轮强制最低3%输球概率，杜绝无脑高分必通关
 * 4. 单场结果仅三种: win / draw / lose；出现draw/lose即挑战失败
 *
 * 输出赛季报告: 总胜、平、负、联赛排名、是否Perfect3800、每轮对战明细
 *
 * 可调概率参数（微调难度）:
 * - MIN_LOSE_RATE: 强制最低输球概率，默认0.03 (3%)
 * - WEAK_DEF_THRESHOLD: 防守薄弱阈值，默认320
 * - WEAK_DEF_DRAW_BONUS: 防守薄弱平局加成，默认0.25 (25%)
 * - WEAK_INT_THRESHOLD: 拦截薄弱阈值，默认280
 * - WEAK_INT_DRAW_BONUS: 拦截薄弱平局加成，默认0.20 (20%)
 * - HOME_WIN_BONUS: 主场胜率加成，默认0.05 (5%)
 * - ROUND_DIFFICULTY_SCALE: 轮次难度递增系数，默认0.005
 */

// ==================== 可调概率参数 ====================

/** 强制最低输球概率（3%） */
var MIN_LOSE_RATE = 0.03;

/** 防线总防守薄弱阈值 */
var WEAK_DEF_THRESHOLD = 320;

/** 防守薄弱时平局概率加成（25%） */
var WEAK_DEF_DRAW_BONUS = 0.25;

/** 中场拦截总值薄弱阈值 */
var WEAK_INT_THRESHOLD = 280;

/** 拦截薄弱时平局概率加成（20%） */
var WEAK_INT_DRAW_BONUS = 0.20;

/** 主场胜率加成（5%） */
var HOME_WIN_BONUS = 0.05;

/** 轮次难度递增系数（每轮+0.5%输球概率） */
var ROUND_DIFFICULTY_SCALE = 0.005;

// ==================== 辅助函数 ====================

/**
 * 计算位置协同加成（阵容越接近标准4-4-2加成越高）
 * GK=1, CB+FB=4, CDM+CAM=4, FW=2
 * @param {Player[]} players - 球员列表
 * @returns {number} 协同加成系数 1.0~1.25
 */
function calcSynergyBonus(players) {
  if (!players || !players.length) return 1.0;
  var counts = { GK: 0, CB: 0, FB: 0, CDM: 0, CAM: 0, FW: 0 };
  for (var i = 0; i < players.length; i++) {
    var pos = players[i].position;
    if (counts.hasOwnProperty(pos)) counts[pos]++;
  }

  var score = 0;
  // GK=1
  if (counts.GK === 1) score += 1;
  // 后卫=4 (CB+FB)
  if ((counts.CB || 0) + (counts.FB || 0) === 4) score += 1;
  // 中场=4 (CDM+CAM)
  if ((counts.CDM || 0) + (counts.CAM || 0) === 4) score += 1;
  // 前锋=2
  if ((counts.FW || 0) === 2) score += 1;

  // 4项全满=1.25, 3项=1.1875, 2项=1.125, 1项=1.0625, 0项=1.0
  return 1.0 + score * 0.0625;
}

/**
 * 计算球队总防守值（直接求和，用于薄弱判定）
 * @param {Team} team - 球队实例
 * @returns {number} 总防守值
 */
function calcTotalDefense(team) {
  if (!team || !team.players) return 0;
  var total = 0;
  for (var i = 0; i < team.players.length; i++) {
    total += (team.players[i].defense || 0);
  }
  return total;
}

/**
 * 计算球队总拦截值（直接求和，用于薄弱判定）
 * @param {Team} team - 球队实例
 * @returns {number} 总拦截值
 */
function calcTotalIntercept(team) {
  if (!team || !team.players) return 0;
  var total = 0;
  for (var i = 0; i < team.players.length; i++) {
    total += (team.players[i].intercept || 0);
  }
  return total;
}

// ==================== LeagueSimulator 类 ====================

class LeagueSimulator {
  /**
   * 构造函数
   * @param {Team} myTeam - 玩家球队（11人完整阵容）
   * @param {Team[]} opponents - 对手球队列表
   */
  constructor(myTeam, opponents) {
    // 空值兜底
    if (!myTeam) myTeam = new Team({ name: '我的球队', players: [] });
    if (!opponents || !Array.isArray(opponents)) opponents = [];

    this.myTeam = myTeam;
    this.opponents = opponents;

    // 赛程与结果
    this.schedule = [];
    this.results = [];
    this.currentRound = 0;
    this.record = { win: 0, draw: 0, lose: 0 };

    // 失败标记
    this.failed = false;
    this.failedRound = -1;

    // 预计算玩家球队属性（避免每轮重复计算）
    this._myPower = Math.max(1, myTeam.getTotalPower() || 1);
    this._myDefense = calcTotalDefense(myTeam);
    this._myIntercept = calcTotalIntercept(myTeam);
    this._synergyBonus = calcSynergyBonus(myTeam.players);

    // 预计算对手战力（避免每轮重复计算）
    this._oppPowerMap = {};
    for (var i = 0; i < opponents.length; i++) {
      var opp = opponents[i];
      this._oppPowerMap[opp.id || opp.name] = Math.max(1, opp.getTotalPower() || 1);
    }
  }

  // ==================== 赛程生成 ====================

  /**
   * 生成38轮赛程（双循环编排）
   * 19个对手 x 主客场 = 38轮
   * 不足19个对手则循环编排补齐
   */
  generateSchedule() {
    this.schedule = [];
    var opps = this.opponents.slice();

    // 不足19个对手则循环补齐
    while (opps.length < 19) {
      opps = opps.concat(this.opponents.slice());
    }
    opps = opps.slice(0, 19);

    // 主场19轮
    for (var i = 0; i < 19; i++) {
      this.schedule.push({
        round: i + 1,
        opponent: opps[i],
        isHome: true
      });
    }
    // 客场19轮
    for (var j = 0; j < 19; j++) {
      this.schedule.push({
        round: 19 + j + 1,
        opponent: opps[j],
        isHome: false
      });
    }
  }

  // ==================== 核心胜负算法 ====================

  /**
   * 模拟单场比赛
   *
   * 概率计算流程:
   * 1. 基础胜率 = 我方战力 / (我方战力 + 对手战力)
   * 2. 应用协同加成调整胜率
   * 3. 防守<320 → 平局概率+25%
   * 4. 拦截<280 → 平局概率+20%
   * 5. 主场胜率+5%
   * 6. 轮次递增难度：每轮+0.5%输球概率
   * 7. 强制最低3%输球概率
   * 8. 剩余概率按胜/平分配，平局优先
   *
   * @param {Object} match - 比赛信息 { round, opponent, isHome }
   * @returns {Object} 比赛结果
   */
  simulateMatch(match) {
    var round = this.currentRound + 1;
    var opp = match.opponent;
    var oppKey = opp.id || opp.name;

    // ---- 1. 基础胜率 ----
    var oppPower = this._oppPowerMap[oppKey] || Math.max(1, opp.getTotalPower() || 1);
    var baseWinRate = this._myPower / (this._myPower + oppPower);

    // ---- 2. 协同加成 ----
    baseWinRate *= this._synergyBonus;
    // 归一化到 [0, 1]
    baseWinRate = Math.min(0.97, Math.max(0.03, baseWinRate));

    // ---- 3. 防守薄弱 → 平局概率+25% ----
    var drawBonus = 0;
    // 基础平局概率（确保任何阵容都有平局可能）
    var BASE_DRAW_RATE = 0.05;
    drawBonus += BASE_DRAW_RATE;
    if (this._myDefense < WEAK_DEF_THRESHOLD) {
      drawBonus += WEAK_DEF_DRAW_BONUS;
    }

    // ---- 4. 拦截薄弱 → 平局概率+20% ----
    if (this._myIntercept < WEAK_INT_THRESHOLD) {
      drawBonus += WEAK_INT_DRAW_BONUS;
    }

    // ---- 5. 主场加成 ----
    var homeBonus = match.isHome ? HOME_WIN_BONUS : 0;

    // ---- 6. 轮次递增难度 ----
    var roundLoseExtra = round * ROUND_DIFFICULTY_SCALE;

    // ---- 7. 计算最终概率 ----
    // 输球概率 = 基础输球 + 轮次递增，最低 MIN_LOSE_RATE，上限0.5（防止后期必输）
    var loseRate = Math.max(MIN_LOSE_RATE, Math.min(0.5, (1 - baseWinRate) + roundLoseExtra));
    // 平局概率 = 基础平局 + 防守/拦截薄弱加成
    var drawRate = drawBonus;
    // 胜率 = 1 - 输 - 平 + 主场加成
    var winRate = 1 - loseRate - drawRate + homeBonus;

    // ---- 8. 边界修正（防止概率异常） ----
    // 胜率不能低于5%
    if (winRate < 0.05) winRate = 0.05;
    // 输球概率不能低于 MIN_LOSE_RATE
    if (loseRate < MIN_LOSE_RATE) loseRate = MIN_LOSE_RATE;
    // 平局概率不能为负
    if (drawRate < 0) drawRate = 0;
    // 重新归一化
    var total = winRate + loseRate + drawRate;
    if (total <= 0) total = 1;
    winRate = winRate / total;
    loseRate = loseRate / total;
    drawRate = drawRate / total;

    // ---- 9. 随机判定结果 ----
    var rand = Math.random();
    var result;
    if (rand < winRate) {
      result = 'win';
    } else if (rand < winRate + drawRate) {
      result = 'draw';
    } else {
      result = 'lose';
    }

    // ---- 10. 生成比分（仅用于展示，不影响胜负） ----
    var myGoals = 0;
    var oppGoals = 0;
    if (result === 'win') {
      myGoals = RandomUtil.randomInt(1, 4);
      oppGoals = RandomUtil.randomInt(0, Math.max(0, myGoals - 1));
    } else if (result === 'draw') {
      var drawScore = RandomUtil.randomInt(0, 3);
      myGoals = drawScore;
      oppGoals = drawScore;
    } else {
      oppGoals = RandomUtil.randomInt(1, 4);
      myGoals = RandomUtil.randomInt(0, Math.max(0, oppGoals - 1));
    }

    return {
      round: round,
      myGoals: myGoals,
      oppGoals: oppGoals,
      result: result,
      opponent: opp,
      isHome: match.isHome,
      winRate: Math.round(winRate * 1000) / 10,
      drawRate: Math.round(drawRate * 1000) / 10,
      loseRate: Math.round(loseRate * 1000) / 10
    };
  }

  // ==================== 逐轮模拟 ====================

  /**
   * 模拟下一轮比赛
   * @returns {Object|null} 比赛结果，已完赛返回null
   */
  simulateNextRound() {
    if (this.currentRound >= this.schedule.length) return null;
    if (this.failed) return null;

    var match = this.schedule[this.currentRound];
    var result = this.simulateMatch(match);
    this.results.push(result);
    this.currentRound++;

    // 更新战绩
    this.record[result.result]++;

    // 检查是否失败（平局或输球）
    if (result.result === 'draw' || result.result === 'lose') {
      this.failed = true;
      this.failedRound = this.currentRound;
    }

    return result;
  }

  /**
   * 执行完整38轮模拟，带进度回调
   * @param {Function} [onProgress] - 进度回调 function(round, result, record)
   * @returns {Object} 赛季总结报告
   */
  runFull38Match(onProgress) {
    // 重置状态
    this.results = [];
    this.currentRound = 0;
    this.record = { win: 0, draw: 0, lose: 0 };
    this.failed = false;
    this.failedRound = -1;

    // 确保赛程已生成
    if (this.schedule.length === 0) {
      this.generateSchedule();
    }

    // 逐轮模拟（基于schedule长度而非硬编码38）
    var totalRounds = this.schedule.length;
    while (this.currentRound < totalRounds && !this.failed) {
      var result = this.simulateNextRound();
      if (result && typeof onProgress === 'function') {
        onProgress(this.currentRound, result, {
          win: this.record.win,
          draw: this.record.draw,
          lose: this.record.lose
        });
      }
    }

    return this.getSeasonSummary();
  }

  /**
   * 模拟所有剩余轮次（跳过时使用）
   */
  simulateAllRemaining() {
    while (this.currentRound < this.schedule.length && !this.failed) {
      this.simulateNextRound();
    }
  }

  // ==================== 赛季报告 ====================

  /**
   * 获取赛季总结报告
   * @returns {Object} 赛季报告数据
   */
  getSeasonSummary() {
    var isPerfect = this.currentRound >= this.schedule.length && this.record.win === this.schedule.length && !this.failed;

    // 计算联赛排名（模拟积分：胜3分 平1分 负0分）
    var myPoints = this.record.win * 3 + this.record.draw * 1;
    // 对手积分模拟（简化：按战力比例分配）
    var opponentPoints = [];
    for (var i = 0; i < this.opponents.length; i++) {
      var opp = this.opponents[i];
      var oppKey = opp.id || opp.name;
      var oppPower = this._oppPowerMap[oppKey] || 50;
      // 简化积分：战力越高积分越高，加随机浮动
      var estPoints = Math.round(oppPower * 0.4 + RandomUtil.randomInt(-5, 10));
      opponentPoints.push({ name: opp.name, points: Math.max(0, estPoints) });
    }
    opponentPoints.sort(function(a, b) { return b.points - a.points; });

    // 计算排名
    var rank = 1;
    for (var j = 0; j < opponentPoints.length; j++) {
      if (opponentPoints[j].points > myPoints) rank++;
    }

    return {
      /** 战绩字符串 "W-D-L" */
      record: this.getRecordString(),
      /** 胜场数 */
      wins: this.record.win,
      /** 平局数 */
      draws: this.record.draw,
      /** 负场数 */
      loses: this.record.lose,
      /** 联赛积分 */
      points: myPoints,
      /** 联赛排名 */
      rank: rank,
      /** 是否完美赛季 38-0-0 */
      isPerfect: isPerfect,
      /** 是否挑战失败 */
      isFailed: this.failed,
      /** 失败信息 */
      failInfo: this.getFailInfo(),
      /** 每轮对战明细 */
      matchDetails: this.results.slice(),
      /** 玩家球队 */
      team: this.myTeam,
      /** 玩家球队战力 */
      teamPower: this._myPower,
      /** 玩家球队总防守 */
      teamDefense: this._myDefense,
      /** 玩家球队总拦截 */
      teamIntercept: this._myIntercept,
      /** 协同加成 */
      synergyBonus: this._synergyBonus,
      /** 对手积分排名 */
      opponentStandings: opponentPoints
    };
  }

  // ==================== 状态查询 ====================

  /** 获取当前战绩字符串 "W-D-L" */
  getRecordString() {
    return this.record.win + '-' + this.record.draw + '-' + this.record.lose;
  }

  /** 是否已失败（出现平局或输球） */
  isFailed() {
    return this.failed;
  }

  /** 是否完美赛季（全部赛程全胜） */
  isPerfect() {
    return this.currentRound >= this.schedule.length && this.record.win === this.schedule.length && !this.failed;
  }

  /** 是否模拟完成 */
  isComplete() {
    return this.currentRound >= this.schedule.length || this.failed;
  }

  /** 获取进度百分比 */
  getProgressPercent() {
    var total = Math.max(1, this.schedule.length);
    return Math.min(100, Math.round((this.currentRound / total) * 100));
  }

  /** 获取失败信息 */
  getFailInfo() {
    if (!this.failed) return null;
    if (this.failedRound < 1 || this.failedRound > this.results.length) {
      return { round: this.failedRound, opponent: '未知', score: '?-?', isHome: false };
    }
    var failResult = this.results[this.failedRound - 1];
    return {
      round: this.failedRound,
      opponent: failResult.opponent.name,
      score: failResult.myGoals + '-' + failResult.oppGoals,
      isHome: failResult.isHome
    };
  }
}
