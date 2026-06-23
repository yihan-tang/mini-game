/**
 * Team 球队模型类
 * 支持细分位置(GK/CB/FB/CDM/CAM/FW)和intercept拦截值
 */
class Team {
  /**
   * 构造函数，接收赛季名称、球队名称、全队球员池
   * @param {Object} config - 球队配置
   * @param {string} config.id - 球队ID
   * @param {string} config.name - 球队名称
   * @param {string} config.shortName - 简称
   * @param {string} config.logo - 球队标识
   * @param {Player[]} config.players - 全队球员池
   * @param {string} config.season - 赛季名称
   * @param {boolean} config.isPlayerTeam - 是否为玩家球队
   */
  constructor(config) {
    // 空值兜底校验
    if (!config) config = {};
    this.id = config.id || '';
    this.name = config.name || '未知球队';
    this.shortName = config.shortName || config.name || '未知';
    this.logo = config.logo || '';
    this.players = this._normalizePlayers(config.players);
    this.season = config.season || '';
    this.isPlayerTeam = !!config.isPlayerTeam;
  }

  /**
   * 规范化球员列表，确保每个元素都是Player实例
   * @param {Array} players - 原始球员数组（可能是普通对象或Player实例）
   * @returns {Player[]} 规范化后的Player实例数组
   */
  _normalizePlayers(players) {
    if (!Array.isArray(players)) return [];
    return players.map(function(p) {
      if (p instanceof Player) return p;
      return Player.fromJSON(p);
    });
  }

  /**
   * 计算球队总进攻值（加权求和）
   * 每个球员: attack * atkWeight + intercept * intWeight * 0.5
   * @returns {number} 球队总进攻值
   */
  getAttack() {
    var total = 0;
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      var w = p.getPositionWeight();
      total += (p.attack || 0) * w.atkWeight + (p.intercept || 0) * w.intWeight * 0.5;
    }
    return Math.round(total);
  }

  /**
   * 计算球队总防守值（加权求和）
   * 每个球员: defense * defWeight + intercept * intWeight * 0.5
   * @returns {number} 球队总防守值
   */
  getDefense() {
    var total = 0;
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      var w = p.getPositionWeight();
      total += (p.defense || 0) * w.defWeight + (p.intercept || 0) * w.intWeight * 0.5;
    }
    return Math.round(total);
  }

  /**
   * 计算球队综合评分
   * @returns {number} (进攻+防守)/2
   */
  getOverall() {
    return Math.round((this.getAttack() + this.getDefense()) / 2);
  }

  /**
   * 按位置筛选球员（支持细分位置和大类两种查询）
   * 细分位置: GK/CB/FB/CDM/CAM/FW
   * 大类位置: GK/DEF/MID/FWD
   * @param {string} pos - 位置（细分或大类）
   * @returns {Player[]} 匹配的球员列表
   */
  getAllPlayersByPos(pos) {
    if (!pos || !this.players.length) return [];
    return this.players.filter(function(p) {
      // 精确匹配细分位置
      if (p.position === pos) return true;
      // 匹配位置大类
      if (p.getPositionGroup() === pos) return true;
      return false;
    });
  }

  /**
   * 获取指定位置大类的球员列表（兼容旧接口）
   * @param {string} position - 位置大类或细分位置
   * @returns {Player[]} 匹配的球员列表
   */
  getPlayersByPosition(position) {
    return this.getAllPlayersByPos(position);
  }

  /**
   * 获取球队总战力（所有球员getSinglePower之和）
   * @returns {number} 球队总战力
   */
  getTotalPower() {
    var total = 0;
    for (var i = 0; i < this.players.length; i++) {
      total += this.players[i].getSinglePower();
    }
    return Math.round(total * 100) / 100;
  }

  /**
   * 获取球队平均战力
   * @returns {number} 球队平均战力
   */
  getAvgPower() {
    if (this.players.length === 0) return 0;
    return Math.round(this.getTotalPower() / this.players.length * 100) / 100;
  }

  /** 序列化为JSON */
  toJSON() {
    return {
      id: this.id, name: this.name, shortName: this.shortName,
      logo: this.logo, season: this.season, isPlayerTeam: this.isPlayerTeam,
      players: this.players.map(function(p) { return p.toJSON(); })
    };
  }

  /**
   * 从JSON恢复Team实例
   * @param {Object} json - 序列化对象
   * @returns {Team} Team实例
   */
  static fromJSON(json) {
    if (!json) return new Team({});
    return new Team({
      id: json.id, name: json.name, shortName: json.shortName,
      logo: json.logo, season: json.season, isPlayerTeam: json.isPlayerTeam,
      players: json.players || []
    });
  }
}
