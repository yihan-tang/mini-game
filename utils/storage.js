/**
 * StorageUtil 本地存储工具
 * 封装LocalStorage操作，管理游戏数据的持久化
 * 兼容无LocalStorage的浏览器环境，不报错崩溃
 * 编码: UTF-8
 */
var StorageUtil = {
  /** 存储键名 */
  KEYS: {
    BEST_RECORDS: 'game_best_records',
    HISTORY: 'game_history',
    ACHIEVEMENTS: 'game_achievements',
    SETTINGS: 'game_settings'
  },

  /** 最大历史记录数（保留最近10次） */
  MAX_HISTORY: 10,

  /** LocalStorage是否可用（启动时检测一次） */
  _available: false,

  /** 内存兜底存储（LocalStorage不可用时使用） */
  _memoryStore: {},

  /**
   * 初始化检测LocalStorage可用性
   * 尝试写入/读取/删除测试键，失败则标记不可用
   */
  _init: function() {
    if (this._available) return;
    try {
      var testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      this._available = true;
    } catch (e) {
      this._available = false;
    }
  },

  /**
   * 读取数据（兼容兜底：LocalStorage不可用时从内存读取）
   * @param {string} key - 存储键名
   * @returns {*} 解析后的数据，失败返回null
   */
  _get: function(key) {
    this._init();
    try {
      if (this._available) {
        var data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } else {
        // 兜底：从内存存储读取
        return this._memoryStore[key] || null;
      }
    } catch (e) {
      // LocalStorage运行时异常（如隐私模式被禁用），降级为内存存储
      this._available = false;
      return this._memoryStore[key] || null;
    }
  },

  /**
   * 写入数据（兼容兜底：LocalStorage不可用时写入内存）
   * @param {string} key - 存储键名
   * @param {*} value - 要存储的数据
   */
  _set: function(key, value) {
    this._init();
    try {
      if (this._available) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      // 无论LocalStorage是否可用，都写入内存兜底（防止运行时降级丢数据）
      this._memoryStore[key] = value;
    } catch (e) {
      // 存储满或不可用时静默失败，写入内存兜底
      this._available = false;
      this._memoryStore[key] = value;
    }
  },

  /**
   * 删除指定键的数据
   * @param {string} key - 存储键名
   */
  _remove: function(key) {
    this._init();
    try {
      if (this._available) {
        localStorage.removeItem(key);
      }
      delete this._memoryStore[key];
    } catch (e) {
      // 静默失败
    }
  },

  // ==================== 最佳战绩 ====================

  /**
   * 获取最佳战绩（按模式分组）
   * @returns {Object} { league: {...}, cup: {...} }
   */
  getBestRecords: function() {
    return this._get(this.KEYS.BEST_RECORDS) || {};
  },

  /**
   * 保存历史最佳完美赛季记录
   * 仅在胜场更多或同胜场但更接近完美时更新
   * @param {Object} result - 赛季结果 { mode, team, season, wins, draws, loses, isPerfect, timestamp }
   */
  saveBestRecord: function(result) {
    if (!result || !result.mode) return;
    var best = this.getBestRecords();
    var mode = result.mode;
    var current = best[mode];
    var shouldUpdate = false;

    if (!current) {
      // 首次记录，直接保存
      shouldUpdate = true;
    } else if (result.wins > current.wins) {
      // 胜场更多，更新
      shouldUpdate = true;
    } else if (result.wins === current.wins && result.isPerfect && !current.isPerfect) {
      // 同胜场但当前是完美赛季，优先完美
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      best[mode] = {
        mode: result.mode,
        team: result.team,
        season: result.season,
        wins: result.wins,
        draws: result.draws,
        loses: result.loses,
        isPerfect: result.isPerfect,
        timestamp: result.timestamp || Date.now()
      };
      this._set(this.KEYS.BEST_RECORDS, best);
    }
  },

  /**
   * 读取最佳战绩存档，首页展示用
   * @param {string} [mode] - 游戏模式，不传则返回全部
   * @returns {Object|null} 最佳战绩数据
   */
  getBestRecord: function(mode) {
    var best = this.getBestRecords();
    if (mode) return best[mode] || null;
    return best;
  },

  /**
   * 更新最佳战绩（仅在更好时更新）
   * 兼容旧接口，内部调用saveBestRecord
   * @param {string} mode - 游戏模式
   * @param {Object} newRecord - 新记录
   */
  updateBestRecord: function(mode, newRecord) {
    // 兼容旧调用方式：将mode注入record后调用新方法
    if (newRecord && !newRecord.mode) {
      newRecord.mode = mode;
    }
    this.saveBestRecord(newRecord);
  },

  // ==================== 历史记录 ====================

  /**
   * 获取历史记录
   * @returns {Array} 历史记录数组
   */
  getHistory: function() {
    return this._get(this.KEYS.HISTORY) || [];
  },

  /**
   * 保存最近10次模拟战绩（整体替换）
   * @param {Array} arr - 历史记录数组
   */
  saveHistoryRecords: function(arr) {
    if (!Array.isArray(arr)) return;
    // 只保留最近10条
    var records = arr.slice(0, this.MAX_HISTORY);
    this._set(this.KEYS.HISTORY, records);
  },

  /**
   * 添加历史记录（保留最近10条）
   * @param {Object} record - 单条记录
   */
  addHistory: function(record) {
    var history = this.getHistory();
    history.unshift(record);
    if (history.length > this.MAX_HISTORY) {
      history = history.slice(0, this.MAX_HISTORY);
    }
    this._set(this.KEYS.HISTORY, history);
  },

  /**
   * 清空历史记录
   */
  clearHistory: function() {
    this._set(this.KEYS.HISTORY, []);
  },

  // ==================== 成就系统 ====================

  /**
   * 获取已解锁成就ID列表
   * @returns {Array} 成就ID数组
   */
  getAchievements: function() {
    return this._get(this.KEYS.ACHIEVEMENTS) || [];
  },

  /**
   * 解锁成就，存储成就列表
   * @param {string} name - 成就ID（如 'perfect_season'）
   * @returns {boolean} 是否为新解锁（之前未解锁返回true）
   */
  unlockAchievement: function(name) {
    if (!name) return false;
    var achievements = this.getAchievements();
    if (achievements.indexOf(name) === -1) {
      achievements.push(name);
      this._set(this.KEYS.ACHIEVEMENTS, achievements);
      return true; // 新解锁
    }
    return false; // 已解锁过
  },

  /**
   * 获取全部解锁成就的完整信息
   * @returns {Array} 成就对象数组 [{ id, name, desc, unlockedAt }]
   */
  getAllAchievements: function() {
    var unlockedIds = this.getAchievements();
    var result = [];
    for (var i = 0; i < unlockedIds.length; i++) {
      var id = unlockedIds[i];
      var ach = ACHIEVEMENTS[id];
      if (ach) {
        result.push({
          id: id,
          name: ach.name,
          desc: ach.desc,
          unlockedAt: ach.timestamp || null
        });
      }
    }
    return result;
  },

  /**
   * 检查成就是否已解锁
   * @param {string} achievementId - 成就ID
   * @returns {boolean}
   */
  isAchievementUnlocked: function(achievementId) {
    var achievements = this.getAchievements();
    return achievements.indexOf(achievementId) !== -1;
  },

  // ==================== 设置 ====================

  /**
   * 获取设置
   * @returns {Object} 设置对象
   */
  getSettings: function() {
    return this._get(this.KEYS.SETTINGS) || { simSpeed: 'normal' };
  },

  /**
   * 更新设置
   * @param {Object} settings - 要更新的设置项
   */
  updateSettings: function(settings) {
    var current = this.getSettings();
    var merged = {};
    for (var k in current) merged[k] = current[k];
    for (var k2 in settings) merged[k2] = settings[k2];
    this._set(this.KEYS.SETTINGS, merged);
  },

  // ==================== 数据重置 ====================

  /**
   * 一键重置所有存档数据
   * 清除最佳战绩、历史记录、成就、设置
   */
  clearAllGameData: function() {
    this._remove(this.KEYS.BEST_RECORDS);
    this._remove(this.KEYS.HISTORY);
    this._remove(this.KEYS.ACHIEVEMENTS);
    this._remove(this.KEYS.SETTINGS);
    // 清空内存兜底存储
    this._memoryStore = {};
  }
};
