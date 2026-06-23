/**
 * DraftSystem 选修逻辑类
 * 管理11轮选修流程：GK x1 + DEF x4 + MID x4 + FWD x2
 * 位置细分: GK门将, CB中后卫/FB边后卫→DEF, CDM防守中场/CAM进攻中场→MID, FW前锋→FWD
 *
 * 完整流程:
 * 1. 传入当前选中Team实例，获取球队名称和赛季信息
 * 2. 每轮根据当前位置，从球员池随机抽取3名同位置候选球员
 * 3. 玩家选择后存入阵容，校验位置数量不溢出
 * 4. 11轮选完后校验是否凑齐11人，通过则自动跳转模拟页
 */
class DraftSystem {
  /**
   * 构造函数
   * @param {Team} selectedTeam - 当前选中的球队实例（提供球队名称、赛季信息）
   * @param {Object[]} playerPool - 可选球员数据池（普通对象数组，来自data.js全部球队）
   */
  constructor(selectedTeam, playerPool) {
    // 空值兜底
    if (!selectedTeam) selectedTeam = { name: '我的球队', season: '' };
    if (!playerPool || !Array.isArray(playerPool)) playerPool = [];

    this.selectedTeam = selectedTeam;
    this.teamName = selectedTeam.name || '我的球队';
    this.season = selectedTeam.season || '';
    this.playerPool = playerPool;

    /** 已选中的球员列表 */
    this.selectedPlayers = [];
    /** 当前轮次（0-10） */
    this.currentRound = 0;
    /** 当前轮次的候选球员列表 */
    this.currentOptions = [];
    /** 已使用的球员ID集合，防止重复选取 */
    this._usedPlayerIds = new Set();

    /** 选人防连点锁（防止300ms动画内重复点击） */
    this._selecting = false;

    /** 11轮选修位置大类顺序：门将→4后卫→4中场→2前锋 */
    this.draftOrder = [
      'GK', 'DEF', 'DEF', 'DEF', 'DEF',
      'MID', 'MID', 'MID', 'MID',
      'FWD', 'FWD'
    ];

    /** 各位置大类需要的数量 */
    this.positionRequired = { GK: 1, DEF: 4, MID: 4, FWD: 2 };

    /** 位置大类→细分位置的映射 */
    this.positionMap = {
      GK:  ['GK'],
      DEF: ['CB', 'FB'],
      MID: ['CDM', 'CAM'],
      FWD: ['FW']
    };

    /** 位置大类中文名 */
    this.positionNames = {
      GK: '门将', DEF: '后卫', MID: '中场', FWD: '前锋'
    };

    /** 细分位置中文名 */
    this.detailPositionNames = {
      GK: '门将', CB: '中后卫', FB: '边后卫', CDM: '防守中场', CAM: '进攻中场', FW: '前锋'
    };
  }

  // ==================== 轮次信息 ====================

  /**
   * 获取当前轮次需要选择的位置大类
   * @returns {string} 位置大类（GK/DEF/MID/FWD）
   */
  getCurrentPosition() {
    if (this.currentRound >= this.draftOrder.length) return null;
    return this.draftOrder[this.currentRound];
  }

  /**
   * 获取位置大类中文名
   * @param {string} position - 位置大类
   * @returns {string} 中文名
   */
  getPositionName(position) {
    return this.positionNames[position] || position;
  }

  /**
   * 获取细分位置中文名
   * @param {string} position - 细分位置
   * @returns {string} 中文名
   */
  getDetailPositionName(position) {
    return this.detailPositionNames[position] || position;
  }

  /**
   * 获取选修进度百分比
   * @returns {number} 0-100
   */
  getProgressPercent() {
    return Math.round((this.currentRound / this.draftOrder.length) * 100);
  }

  // ==================== 候选球员生成 ====================

  /**
   * 为当前轮次生成3名候选球员（梯度选取：高/中/低）
   * 从球员池中筛选当前大类对应的所有细分位置球员
   * @returns {Object[]} 3名候选球员数组
   */
  generateOptions() {
    var posGroup = this.getCurrentPosition();
    // 选修已完成，不再生成
    if (!posGroup) {
      this.currentOptions = [];
      return this.currentOptions;
    }

    var subPositions = this.positionMap[posGroup] || [posGroup];

    // 筛选对应细分位置且未使用的球员
    var pool = this.playerPool.filter(function(p) {
      return subPositions.indexOf(p.position) !== -1 && !this._usedPlayerIds.has(p.id);
    }.bind(this));

    // 球员池不足3人时返回全部
    if (pool.length <= 3) {
      this.currentOptions = pool.slice();
      return this.currentOptions;
    }

    // 梯度选取3人：按overall排序后分3个区间（高/中/低），各取1人
    var sorted = pool.slice().sort(function(a, b) { return (b.overall || 0) - (a.overall || 0); });
    var third = Math.max(1, Math.floor(sorted.length / 3));
    var sections = [
      sorted.slice(0, third),             // 高分区间
      sorted.slice(third, third * 2),     // 中分区间
      sorted.slice(third * 2)             // 低分区间
    ];

    var options = [];
    var usedIds = {};

    for (var i = 0; i < sections.length; i++) {
      // 区间为空则从其他区间补充
      var section = sections[i].length > 0 ? sections[i] :
        sections.filter(function(s) { return s.length > 0; })[0] || [];
      var available = section.filter(function(p) { return !usedIds[p.id]; });
      var pick = RandomUtil.randomPick(available);
      if (pick) {
        options.push(pick);
        usedIds[pick.id] = true;
      }
    }

    // 不足3人时从剩余池中补充
    while (options.length < 3 && options.length < pool.length) {
      var remaining = pool.filter(function(p) { return !usedIds[p.id]; });
      if (remaining.length === 0) break;
      var extra = RandomUtil.randomPick(remaining);
      options.push(extra);
      usedIds[extra.id] = true;
    }

    // 按overall降序排列
    this.currentOptions = options.sort(function(a, b) { return (b.overall || 0) - (a.overall || 0); });
    return this.currentOptions;
  }

  // ==================== 选择球员 ====================

  /**
   * 选择球员（传入当前选项的索引 0-2）
   * 校验位置数量不溢出，校验索引有效性
   * @param {number} optionIndex - 选项索引（0/1/2）
   * @returns {Object|null} 选中的球员数据，校验失败返回null
   */
  selectPlayer(optionIndex) {
    // 防连点锁：选人动画期间拒绝新点击
    if (this._selecting) return null;

    // 索引校验
    if (optionIndex < 0 || optionIndex >= this.currentOptions.length) {
      console.warn('[DraftSystem] 无效的选项索引:', optionIndex);
      return null;
    }

    var player = this.currentOptions[optionIndex];
    if (!player) {
      console.warn('[DraftSystem] 选项不存在:', optionIndex);
      return null;
    }

    // 重复选取校验
    if (this._usedPlayerIds.has(player.id)) {
      console.warn('[DraftSystem] 球员已被选取:', player.name);
      return null;
    }

    // 位置数量溢出校验
    var posGroup = this.getPositionGroup(player.position);
    var currentCount = this.getSelectedCountByPosition(posGroup);
    var maxCount = this.positionRequired[posGroup] || 0;
    if (currentCount >= maxCount) {
      console.warn('[DraftSystem] 位置已满:', posGroup, '当前:', currentCount, '上限:', maxCount);
      return null;
    }

    // 加锁
    this._selecting = true;

    // 存入阵容
    this.selectedPlayers.push(player);
    this._usedPlayerIds.add(player.id);
    this.currentRound++;

    return player;
  }

  /**
   * 解除选人锁（动画结束后由app.js调用）
   */
  unlockSelect() {
    this._selecting = false;
  }

  // ==================== 阵容统计 ====================

  /**
   * 获取已选球员中指定位置大类的数量
   * @param {string} positionGroup - 位置大类（GK/DEF/MID/FWD）
   * @returns {number} 该位置已选球员数
   */
  getSelectedCountByPosition(positionGroup) {
    var subPositions = this.positionMap[positionGroup] || [positionGroup];
    return this.selectedPlayers.filter(function(p) {
      return subPositions.indexOf(p.position) !== -1;
    }).length;
  }

  /**
   * 获取指定位置大类还需要选择的数量
   * @param {string} positionGroup - 位置大类
   * @returns {number} 还需选择的数量
   */
  getRemainingByPosition(positionGroup) {
    var total = this.positionRequired[positionGroup] || 0;
    return total - this.getSelectedCountByPosition(positionGroup);
  }

  /**
   * 计算整套阵容总统计
   * 包含总防守、总进攻、总拦截、总战力
   * @returns {Object} { totalDefense, totalAttack, totalIntercept, totalPower, playerCount }
   */
  getTotalTeamStat() {
    var totalDefense = 0;
    var totalAttack = 0;
    var totalIntercept = 0;
    var totalPower = 0;

    for (var i = 0; i < this.selectedPlayers.length; i++) {
      var p = this.selectedPlayers[i];
      // 将普通对象转为Player实例以调用方法
      var player = (p instanceof Player) ? p : Player.fromJSON(p);
      totalDefense += player.defense || 0;
      totalAttack += player.attack || 0;
      totalIntercept += player.intercept || 0;
      totalPower += player.getSinglePower();
    }

    return {
      totalDefense: Math.round(totalDefense),
      totalAttack: Math.round(totalAttack),
      totalIntercept: Math.round(totalIntercept),
      totalPower: Math.round(totalPower * 100) / 100,
      playerCount: this.selectedPlayers.length
    };
  }

  // ==================== 完成校验 ====================

  /**
   * 选修是否完成（11轮全部选完）
   * @returns {boolean}
   */
  isComplete() {
    return this.currentRound >= this.draftOrder.length;
  }

  /**
   * 阵容是否就绪（严格11人，各位置数量正确）
   * @returns {boolean}
   */
  isDraftReady() {
    // 必须选满11人
    if (this.selectedPlayers.length !== 11) return false;
    // 各位置数量必须匹配
    var groups = ['GK', 'DEF', 'MID', 'FWD'];
    for (var i = 0; i < groups.length; i++) {
      if (this.getSelectedCountByPosition(groups[i]) !== this.positionRequired[groups[i]]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取阵容缺失信息（用于弹窗提示）
   * @returns {Object|null} 缺失信息，阵容完整返回null
   */
  getMissingInfo() {
    if (this.isDraftReady()) return null;

    var missing = [];
    var groups = ['GK', 'DEF', 'MID', 'FWD'];
    for (var i = 0; i < groups.length; i++) {
      var remaining = this.getRemainingByPosition(groups[i]);
      if (remaining > 0) {
        missing.push(this.getPositionName(groups[i]) + '还缺' + remaining + '人');
      }
    }

    return {
      totalMissing: 11 - this.selectedPlayers.length,
      details: missing
    };
  }

  // ==================== 构建球队 ====================

  /**
   * 构建玩家球队（选修完成后调用）
   * 校验阵容完整性，不满足则返回null
   * @returns {Team|null} 玩家球队实例，校验失败返回null
   */
  buildTeam() {
    // 严格校验：必须凑齐11人
    if (!this.isDraftReady()) {
      var missing = this.getMissingInfo();
      var msg = '阵容不完整！还需选择' + missing.totalMissing + '名球员：' + missing.details.join('，');
      alert(msg);
      return null;
    }

    var players = this.selectedPlayers.map(function(p) {
      return (p instanceof Player) ? p : Player.fromJSON(p);
    });

    return new Team({
      id: 'player_team',
      name: this.teamName,
      shortName: this.teamName,
      season: this.season,
      players: players,
      isPlayerTeam: true
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 获取已选球员列表
   * @returns {Object[]} 已选球员数组
   */
  getSelectedPlayers() {
    return this.selectedPlayers;
  }

  /**
   * 获取细分位置对应的位置大类
   * @param {string} position - 细分位置（GK/CB/FB/CDM/CAM/FW）
   * @returns {string} 位置大类（GK/DEF/MID/FWD）
   */
  getPositionGroup(position) {
    var map = { GK: 'GK', CB: 'DEF', FB: 'DEF', CDM: 'MID', CAM: 'MID', FW: 'FWD' };
    return map[position] || 'FWD';
  }
}
