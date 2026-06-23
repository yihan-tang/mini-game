/**
 * RandomUtil 随机工具函数库
 * 封装全部随机相关函数，通过 RandomUtil 命名空间导出，无全局污染
 * 编码: UTF-8
 */
var RandomUtil = (function() {
  'use strict';

  // ==================== 基础随机函数 ====================

  /**
   * 区间随机整数 [min, max]
   * @param {number} min - 最小值（含），兜底为0
   * @param {number} max - 最大值（含），兜底为min
   * @returns {number} 随机整数
   */
  function randomInt(min, max) {
    min = Math.max(0, Number(min) || 0);
    max = Math.max(min, Number(max) || min);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 从数组中随机选取一个元素
   * @param {Array} arr - 源数组
   * @returns {*} 随机元素，空数组返回null
   */
  function randomPick(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * 从数组中无重复随机抽取n个元素（Fisher-Yates洗牌）
   * @param {Array} arr - 源数组
   * @param {number} n - 选取数量
   * @returns {Array} 选取的元素数组
   */
  function randomPickN(arr, n) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return [];
    var count = Math.min(Number(n) || 0, arr.length);
    if (count <= 0) return [];
    var copy = arr.slice();
    for (var i = copy.length - 1; i > copy.length - 1 - count; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy.slice(copy.length - count);
  }

  /**
   * 无重复随机抽取3个元素（选秀候选专用）
   * 数组不足3个时返回全部元素
   * @param {Array} arr - 源数组
   * @returns {Array} 最多3个不重复元素
   */
  function pickThreeFromList(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return [];
    return randomPickN(arr, Math.min(3, arr.length));
  }

  // ==================== 泊松分布 ====================

  /**
   * 泊松分布随机数生成（Knuth算法）
   * lambda>30时切换正态近似，避免下溢
   * @param {number} lambda - 期望值
   * @returns {number} 泊松随机数
   */
  function poissonRandom(lambda) {
    lambda = Math.max(0, Number(lambda) || 0);
    if (lambda <= 0) return 0;
    if (lambda > 30) {
      var normal = Math.sqrt(lambda) *
        (Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random())) + lambda;
      return Math.max(0, Math.round(normal));
    }
    var L = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  // ==================== 加权随机 ====================

  /**
   * 加权随机选取
   * @param {Array} items - 候选项数组
   * @param {string} weightKey - 权重属性名
   * @returns {*} 加权随机选取的元素
   */
  function weightedRandomPick(items, weightKey) {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    var totalWeight = 0;
    for (var i = 0; i < items.length; i++) {
      totalWeight += (Number(items[i][weightKey]) || 1);
    }
    var rand = Math.random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < items.length; j++) {
      cumulative += (Number(items[j][weightKey]) || 1);
      if (rand <= cumulative) return items[j];
    }
    return items[items.length - 1];
  }

  // ==================== 梯度选取（选秀用） ====================

  /**
   * 生成有梯度的5个选项（高/中高/中/中低/低）
   * 从球员池中选取5名球员，确保数值有明显差异
   * @param {Array} pool - 球员池
   * @param {string} sortKey - 排序属性（如overall）
   * @returns {Array} 5个球员，按sortKey降序
   */
  function pickGradientOptions(pool, sortKey) {
    if (!pool || !Array.isArray(pool) || pool.length === 0) return [];
    if (pool.length <= 5) {
      return pool.slice().sort(function(a, b) { return (b[sortKey] || 0) - (a[sortKey] || 0); });
    }

    // 按数值排序
    var sorted = pool.slice().sort(function(a, b) { return (b[sortKey] || 0) - (a[sortKey] || 0); });

    // 将池子分为5个区间：高/中高/中/中低/低
    var fifth = Math.max(1, Math.floor(sorted.length / 5));
    var pools = [
      sorted.slice(0, fifth),
      sorted.slice(fifth, fifth * 2),
      sorted.slice(fifth * 2, fifth * 3),
      sorted.slice(fifth * 3, fifth * 4),
      sorted.slice(fifth * 4)
    ];

    // 从每个区间随机选1个
    var options = [];
    var usedIds = {};

    for (var i = 0; i < pools.length; i++) {
      var section = pools[i].length > 0 ? pools[i] :
        pools.filter(function(p) { return p.length > 0; })[0] || [];
      var available = section.filter(function(p) { return !usedIds[p.id]; });
      var pick = randomPick(available);
      if (pick) {
        options.push(pick);
        usedIds[pick.id] = true;
      }
    }

    // 如果不足5个，从剩余池中补充
    while (options.length < 5 && options.length < pool.length) {
      var remaining = pool.filter(function(p) { return !usedIds[p.id]; });
      if (remaining.length === 0) break;
      var extra = randomPick(remaining);
      options.push(extra);
      usedIds[extra.id] = true;
    }

    // 按sortKey降序排列
    return options.sort(function(a, b) { return (b[sortKey] || 0) - (a[sortKey] || 0); });
  }

  // ==================== AI对手球队生成 ====================

  /** AI对手球队名称池 */
  var AI_TEAM_NAMES = [
    '红魔联队', '蓝狮城', '白鹰飞翼', '黑豹竞技', '金鹰战士',
    '银狼突击', '紫龙之翼', '翡翠流星', '烈焰凤凰', '暗夜游侠',
    '钢铁堡垒', '雷霆之怒', '暴风骑士', '极光之子', '星辰远征',
    '苍穹之鹰', '深渊巨兽', '圣光守护', '冰霜之刃', '沙漠风暴'
  ];

  /** 位置标准配置: 4-4-2阵型 */
  var AI_FORMATION = [
    { pos: 'GK', count: 1 },
    { pos: 'CB', count: 2 },
    { pos: 'FB', count: 2 },
    { pos: 'CDM', count: 2 },
    { pos: 'CAM', count: 2 },
    { pos: 'FW', count: 2 }
  ];

  /** 位置对应的数值范围偏移（相对于基础区间） */
  var POS_STAT_OFFSET = {
    GK:  { atkBase: 30, atkRange: 30, defBase: 60, defRange: 25, intBase: 20, intRange: 15 },
    CB:  { atkBase: 30, atkRange: 30, defBase: 65, defRange: 25, intBase: 55, intRange: 25 },
    FB:  { atkBase: 50, atkRange: 30, defBase: 55, defRange: 25, intBase: 45, intRange: 25 },
    CDM: { atkBase: 50, atkRange: 30, defBase: 55, defRange: 25, intBase: 60, intRange: 25 },
    CAM: { atkBase: 65, atkRange: 25, defBase: 35, defRange: 25, intBase: 45, intRange: 25 },
    FW:  { atkBase: 70, atkRange: 25, defBase: 30, defRange: 20, intBase: 30, intRange: 20 }
  };

  /**
   * 生成模拟对战AI球队
   * 随机生成11名球员，战力在指定区间内浮动
   * @param {number} [powerLevel=50] - 战力等级 1-99，越高球队越强
   * @param {string} [teamName] - 球队名称，不传则随机生成
   * @returns {Team} AI对手球队实例
   */
  function randomOpponentTeam(powerLevel, teamName) {
    powerLevel = Math.min(99, Math.max(1, Number(powerLevel) || 50));
    teamName = teamName || randomPick(AI_TEAM_NAMES) || 'AI球队';

    var players = [];
    var idCounter = 1;

    for (var i = 0; i < AI_FORMATION.length; i++) {
      var posConfig = AI_FORMATION[i];
      var offset = POS_STAT_OFFSET[posConfig.pos] || POS_STAT_OFFSET.FW;

      for (var j = 0; j < posConfig.count; j++) {
        // 基于战力等级计算各属性，加入随机浮动
        var atk = randomInt(
          offset.atkBase + Math.floor(powerLevel * 0.15),
          offset.atkBase + offset.atkRange + Math.floor(powerLevel * 0.2)
        );
        var def = randomInt(
          offset.defBase + Math.floor(powerLevel * 0.1),
          offset.defBase + offset.defRange + Math.floor(powerLevel * 0.15)
        );
        var intVal = randomInt(
          offset.intBase + Math.floor(powerLevel * 0.1),
          offset.intBase + offset.intRange + Math.floor(powerLevel * 0.15)
        );
        // 综合值取攻防加权平均
        var ovr = Math.round(atk * 0.4 + def * 0.4 + intVal * 0.2);
        ovr = Math.min(99, Math.max(50, ovr));

        players.push(new Player({
          id: 'AI_' + teamName + '_' + idCounter++,
          name: '球员' + idCounter,
          position: posConfig.pos,
          overall: ovr,
          defense: def,
          attack: atk,
          intercept: intVal,
          nationality: '',
          team: teamName,
          season: '',
          isLegend: false
        }));
      }
    }

    return new Team({
      id: 'AI_' + teamName,
      name: teamName,
      shortName: teamName,
      season: '',
      players: players,
      isPlayerTeam: false
    });
  }

  // ==================== 导出接口 ====================
  return {
    randomInt: randomInt,
    randomPick: randomPick,
    randomPickN: randomPickN,
    pickThreeFromList: pickThreeFromList,
    poissonRandom: poissonRandom,
    weightedRandomPick: weightedRandomPick,
    pickGradientOptions: pickGradientOptions,
    randomOpponentTeam: randomOpponentTeam
  };
})();

// ==================== 向后兼容：保留全局函数快捷方式 ====================
// 已有模块直接调用这些函数名，此处做桥接
var randomInt = RandomUtil.randomInt;
var randomPick = RandomUtil.randomPick;
var randomPickN = RandomUtil.randomPickN;
var poissonRandom = RandomUtil.poissonRandom;
var weightedRandomPick = RandomUtil.weightedRandomPick;
var pickGradientOptions = RandomUtil.pickGradientOptions;
