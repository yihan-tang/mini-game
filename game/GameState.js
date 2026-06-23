/**
 * GameState 全局状态管理
 * 管理游戏页面状态、模式选择、各阶段数据流转
 */

/** 页面状态枚举 */
var PAGE_STATE = {
  HOME: 'home',
  DRAFT: 'draft',
  SIMULATING: 'simulating',
  RESULT: 'result'
};

/** 游戏模式枚举 */
var GAME_MODE = {
  LEAGUE: 'league',
  CUP: 'cup'
};

/** 成就定义（icon对应FontAwesome图标类名） */
var ACHIEVEMENTS = {
  perfect_season:  { name: '金色完美赛季',   desc: '达成38胜0平0负',             icon: 'fa-crown' },
  first_draft:     { name: '初出茅庐',       desc: '完成首次选秀',               icon: 'fa-handshake' },
  league_mode:     { name: '英超征途',       desc: '完成一次英超联赛模式',         icon: 'fa-futbol' },
  cup_mode:        { name: '国家队荣耀',      desc: '完成一次国家队杯赛模式',       icon: 'fa-flag' },
  near_perfect:    { name: '差之毫厘',       desc: '达成37胜1场非胜',             icon: 'fa-heart-crack' },
  streak_10:       { name: '十连胜',         desc: '前10轮全胜',                 icon: 'fa-fire' },
  streak_20:       { name: '二十连胜',       desc: '前20轮全胜',                 icon: 'fa-fire-flame-curved' },
  streak_30:       { name: '三十连胜',       desc: '前30轮全胜',                 icon: 'fa-meteor' },
  all_star:        { name: '银河战舰',       desc: '单队全员95+高评阵容',          icon: 'fa-star' },
  underdog:        { name: '平民奇迹',       desc: '平民球队完美赛季',             icon: 'fa-seedling' },
  sim_100:         { name: '百战老兵',       desc: '累计模拟100次',              icon: 'fa-shield' },
  cup_perfect:     { name: '国家英雄',       desc: '使用国家队拿下完美赛季',        icon: 'fa-trophy' }
};

/** 全局状态对象 */
var GameState = {
  currentPage: PAGE_STATE.HOME,
  gameMode: null,
  selectedTeam: null,
  draftSystem: null,
  leagueSimulator: null,
  finalResult: null,
  newAchievements: [],

  /** 切换页面状态 */
  setPage: function(pageState) {
    // 隐藏所有页面
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.remove('active');
    }
    // 显示目标页面
    var target = document.getElementById('page-' + pageState);
    if (target) target.classList.add('active');
    this.currentPage = pageState;
  },

  /** 开始新游戏 */
  startGame: function(mode) {
    this.gameMode = mode;
    // 随机选择一支球队
    this.selectedTeam = getRandomTeam(mode);
    // 收集该模式下所有球队的球员作为选秀池（深拷贝，防止污染原始data.js）
    var allTeams = getAllTeams(mode);
    var playerPool = [];
    for (var i = 0; i < allTeams.length; i++) {
      var teamPlayers = allTeams[i].players;
      for (var j = 0; j < teamPlayers.length; j++) {
        var p = teamPlayers[j];
        var copy = {};
        for (var k in p) {
          if (p.hasOwnProperty(k)) copy[k] = p[k];
        }
        playerPool.push(copy);
      }
    }
    // 初始化选秀系统（传入选中球队实例和球员池）
    this.draftSystem = new DraftSystem(this.selectedTeam, playerPool);
    this.draftSystem.generateOptions();
    // 跳转选秀页
    this.setPage(PAGE_STATE.DRAFT);
  },

  /** 选修完成，开始模拟 */
  startSimulation: function() {
    // 构建玩家球队（内部校验11人完整性）
    var myTeam = this.draftSystem.buildTeam();
    if (!myTeam) return; // 校验未通过，弹窗已提示
    // 获取对手球队（排除玩家选中的球队），深拷贝防止与选秀池共享引用
    var opponentData = getOpponentTeams(this.gameMode, this.selectedTeam ? this.selectedTeam.id : '');
    var opponents = opponentData.map(function(t) {
      // 深拷贝球员数据，避免修改原始data.js对象
      var players = t.players.map(function(p) {
        var json = (p instanceof Player) ? p.toJSON() : p;
        return Player.fromJSON(json);
      });
      return new Team({
        id: t.id, name: t.name, shortName: t.shortName,
        season: t.season, players: players, isPlayerTeam: false
      });
    });
    // 创建联赛模拟器
    this.leagueSimulator = new LeagueSimulator(myTeam, opponents);
    this.leagueSimulator.generateSchedule();
    // 跳转模拟页
    this.setPage(PAGE_STATE.SIMULATING);
  },

  /** 模拟结束，显示结果 */
  showResult: function() {
    var summary = this.leagueSimulator.getSeasonSummary();
    this.finalResult = summary;
    // 检查成就
    this.newAchievements = [];
    this._checkAchievements();
    // 保存游戏结果
    this._saveGameResult();
    // 显示结果弹窗
    this.setPage(PAGE_STATE.RESULT);
  },

  /** 检查成就 */
  _checkAchievements: function() {
    var sim = this.leagueSimulator;
    var result = this.finalResult;

    // 首次选秀
    if (!StorageUtil.isAchievementUnlocked('first_draft')) {
      StorageUtil.unlockAchievement('first_draft');
      this.newAchievements.push(ACHIEVEMENTS.first_draft);
    }
    // 模式完成
    if (this.gameMode === GAME_MODE.LEAGUE && !StorageUtil.isAchievementUnlocked('league_mode')) {
      StorageUtil.unlockAchievement('league_mode');
      this.newAchievements.push(ACHIEVEMENTS.league_mode);
    }
    if (this.gameMode === GAME_MODE.CUP && !StorageUtil.isAchievementUnlocked('cup_mode')) {
      StorageUtil.unlockAchievement('cup_mode');
      this.newAchievements.push(ACHIEVEMENTS.cup_mode);
    }
    // 完美赛季
    if (result.isPerfect && !StorageUtil.isAchievementUnlocked('perfect_season')) {
      StorageUtil.unlockAchievement('perfect_season');
      this.newAchievements.push(ACHIEVEMENTS.perfect_season);
    }
    // 差之毫厘
    if (result.wins === 37 && !StorageUtil.isAchievementUnlocked('near_perfect')) {
      StorageUtil.unlockAchievement('near_perfect');
      this.newAchievements.push(ACHIEVEMENTS.near_perfect);
    }
    // 连胜成就
    var results = sim.results;
    var streak = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i].result === 'win') streak++;
      else break;
    }
    if (streak >= 10 && !StorageUtil.isAchievementUnlocked('streak_10')) {
      StorageUtil.unlockAchievement('streak_10');
      this.newAchievements.push(ACHIEVEMENTS.streak_10);
    }
    if (streak >= 20 && !StorageUtil.isAchievementUnlocked('streak_20')) {
      StorageUtil.unlockAchievement('streak_20');
      this.newAchievements.push(ACHIEVEMENTS.streak_20);
    }
    if (streak >= 30 && !StorageUtil.isAchievementUnlocked('streak_30')) {
      StorageUtil.unlockAchievement('streak_30');
      this.newAchievements.push(ACHIEVEMENTS.streak_30);
    }

    // ---- 新增成就检测 ----

    // 银河战舰：单队全员95+高评阵容
    if (result.isPerfect && !StorageUtil.isAchievementUnlocked('all_star')) {
      var team = result.team;
      if (team && team.players) {
        var allAbove95 = true;
        for (var p = 0; p < team.players.length; p++) {
          if ((team.players[p].overall || 0) < 95) {
            allAbove95 = false;
            break;
          }
        }
        if (allAbove95) {
          StorageUtil.unlockAchievement('all_star');
          this.newAchievements.push(ACHIEVEMENTS.all_star);
        }
      }
    }

    // 平民奇迹：平民球队完美赛季（阵容平均overall<85）
    if (result.isPerfect && !StorageUtil.isAchievementUnlocked('underdog')) {
      var avgPower = result.teamPower / Math.max(1, result.team.players.length);
      if (avgPower < 85) {
        StorageUtil.unlockAchievement('underdog');
        this.newAchievements.push(ACHIEVEMENTS.underdog);
      }
    }

    // 百战老兵：累计模拟100次
    if (!StorageUtil.isAchievementUnlocked('sim_100')) {
      var history = StorageUtil.getHistory();
      if (history.length >= 100) {
        StorageUtil.unlockAchievement('sim_100');
        this.newAchievements.push(ACHIEVEMENTS.sim_100);
      }
    }

    // 国家英雄：使用国家队拿下完美赛季
    if (result.isPerfect && this.gameMode === GAME_MODE.CUP && !StorageUtil.isAchievementUnlocked('cup_perfect')) {
      StorageUtil.unlockAchievement('cup_perfect');
      this.newAchievements.push(ACHIEVEMENTS.cup_perfect);
    }
  },

  /** 保存游戏结果 */
  _saveGameResult: function() {
    var result = this.finalResult;
    var record = {
      mode: this.gameMode,
      team: result.team.name,
      season: result.team.season,
      wins: result.wins,
      draws: result.draws,
      loses: result.loses,
      isPerfect: result.isPerfect,
      timestamp: Date.now()
    };
    StorageUtil.addHistory(record);
    StorageUtil.updateBestRecord(this.gameMode, record);
  },

  /** 重新开始 */
  restart: function() {
    this.gameMode = null;
    this.selectedTeam = null;
    this.draftSystem = null;
    this.leagueSimulator = null;
    this.finalResult = null;
    this.newAchievements = [];
    this.setPage(PAGE_STATE.HOME);
  }
};
