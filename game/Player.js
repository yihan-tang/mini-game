/**
 * Player 球员实体类
 * 位置分类: GK门将 / CB中后卫 / FB边后卫 / CDM防守中场 / CAM进攻中场 / FW前锋
 */
class Player {
  /**
   * 构造函数，接收球员所有属性
   * @param {Object} config - 球员配置
   * @param {string} config.id - 球员唯一ID
   * @param {string} config.name - 球员姓名
   * @param {string} config.position - 位置: GK/CB/FB/CDM/CAM/FW
   * @param {number} config.overall - 综合总评 70-99
   * @param {number} config.defense - 防守值
   * @param {number} config.attack - 进攻值
   * @param {number} config.intercept - 中场拦截值
   * @param {string} config.nationality - 国籍
   * @param {string} config.team - 所属球队
   * @param {string} config.season - 赛季标识
   * @param {boolean} config.isLegend - 是否传奇球员
   */
  constructor(config) {
    // 空值兜底校验
    if (!config) config = {};
    this.id = config.id || '';
    this.name = config.name || '未知球员';
    this.position = config.position || 'FW';
    this.overall = Math.max(1, Number(config.overall) || 50);
    this.defense = Math.max(1, Number(config.defense) || 50);
    this.attack = Math.max(1, Number(config.attack) || 50);
    this.intercept = Math.max(0, Number(config.intercept) || 0);
    this.nationality = config.nationality || '';
    this.team = config.team || '';
    this.season = config.season || '';
    this.isLegend = !!config.isLegend;
  }

  /**
   * 计算单球员战力值
   * 综合考虑: overall基础 + 位置权重加成 + 传奇加成
   * 公式: overall * 0.5 + (attack * atkW + defense * defW + intercept * intW) * 0.5 + 传奇加成5
   * @returns {number} 单球员战力值
   */
  getSinglePower() {
    var w = this.getPositionWeight();
    // 位置加权战力
    var weightedPower = this.attack * w.atkWeight + this.defense * w.defWeight + this.intercept * w.intWeight;
    // 基础overall + 加权战力，各占50%
    var power = this.overall * 0.5 + weightedPower * 0.5;
    // 传奇球员额外加成
    if (this.isLegend) {
      power += 5;
    }
    return Math.round(power * 100) / 100;
  }

  /**
   * 获取位置大类（用于选秀分组）
   * GK→GK, CB/FB→DEF, CDM/CAM→MID, FW→FWD
   * @returns {string} 位置大类
   */
  getPositionGroup() {
    var map = { GK: 'GK', CB: 'DEF', FB: 'DEF', CDM: 'MID', CAM: 'MID', FW: 'FWD' };
    return map[this.position] || 'FWD';
  }

  /**
   * 获取位置中文名称
   * @returns {string} 位置中文名
   */
  getPositionName() {
    var map = { GK: '门将', CB: '中后卫', FB: '边后卫', CDM: '防守中场', CAM: '进攻中场', FW: '前锋' };
    return map[this.position] || '前锋';
  }

  /**
   * 获取位置攻防权重
   * 返回 { atkWeight, defWeight, intWeight } 用于球队攻防计算
   * @returns {Object} 权重对象
   */
  getPositionWeight() {
    var weights = {
      GK:  { atkWeight: 0.05, defWeight: 0.30, intWeight: 0.05 },
      CB:  { atkWeight: 0.05, defWeight: 0.25, intWeight: 0.15 },
      FB:  { atkWeight: 0.10, defWeight: 0.15, intWeight: 0.10 },
      CDM: { atkWeight: 0.10, defWeight: 0.15, intWeight: 0.25 },
      CAM: { atkWeight: 0.25, defWeight: 0.05, intWeight: 0.15 },
      FW:  { atkWeight: 0.35, defWeight: 0.02, intWeight: 0.05 }
    };
    return weights[this.position] || { atkWeight: 0.15, defWeight: 0.15, intWeight: 0.15 };
  }

  /** 序列化为JSON */
  toJSON() {
    return {
      id: this.id, name: this.name, position: this.position,
      overall: this.overall, defense: this.defense, attack: this.attack,
      intercept: this.intercept, nationality: this.nationality,
      team: this.team, season: this.season, isLegend: this.isLegend
    };
  }

  /**
   * 从JSON恢复Player实例
   * @param {Object} json - 序列化对象
   * @returns {Player} Player实例
   */
  static fromJSON(json) {
    if (!json) return new Player({});
    return new Player(json);
  }
}
