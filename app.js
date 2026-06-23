/**
 * app.js 主控制器
 * 管理所有UI交互，连接GameState与DOM
 * 暴露全局函数: randomTeam, startDraft, runSim, restartGame, captureScreenshot, closeResultModal, toggleSimSpeed
 * 编码: UTF-8
 */

(function() {
  'use strict';

  // ==================== DOM元素引用 ====================
  var $ = function(id) { return document.getElementById(id); };

  // 首页
  var homeTeamPreview = $('home-team-preview');
  var homeTeamName = $('home-team-name');
  var homeTeamSeason = $('home-team-season');
  var homeBestRecord = $('home-best-record');
  var homeBestRecordContent = $('home-best-record-content');
  var homeAchievements = $('home-achievements');
  var homeAchievementsContent = $('home-achievements-content');

  // 选修页
  var draftRoundInfo = $('draft-round-info');
  var draftPositionInfo = $('draft-position-info');
  var draftProgressBar = $('draft-progress-bar');
  var draftCardsContainer = $('draft-cards-container');
  var draftTeamNameEl = $('draft-team-name');
  var draftTeamSeasonEl = $('draft-team-season');
  var draftHint = $('draft-hint');
  var draftTeamStats = $('draft-team-stats');
  var draftStatPower = $('draft-stat-power');
  var draftStatAttack = $('draft-stat-attack');
  var draftStatDefense = $('draft-stat-defense');
  var draftStatIntercept = $('draft-stat-intercept');
  var draftPosGK = $('draft-pos-gk');
  var draftPosDEF = $('draft-pos-def');
  var draftPosMID = $('draft-pos-mid');
  var draftPosFWD = $('draft-pos-fwd');

  // 模拟页
  var simRecord = $('sim-record');
  var simProgressBar = $('sim-progress-bar');
  var simProgressFail = $('sim-progress-fail');
  var simResults = $('sim-results');
  var simRoundLabel = $('sim-round-label');
  var simPoints = $('sim-points');
  var btnSimSpeed = $('btn-sim-speed');

  // 结算弹窗
  var modalResult = $('modal-result');
  var resultCard = $('result-card');
  var resultRecord = $('result-record');
  var resultStatus = $('result-status');
  var resultSubtitle = $('result-subtitle');
  var resultPerfectBadge = $('result-perfect-badge');
  var resultFailInfo = $('result-fail-info');
  var resultFailText = $('result-fail-text');
  var resultStatWins = $('result-stat-wins');
  var resultStatDraws = $('result-stat-draws');
  var resultStatLoses = $('result-stat-loses');
  var resultStatPoints = $('result-stat-points');
  var resultStatRank = $('result-stat-rank');
  var resultTeamPlayers = $('result-team-players');
  var resultAchievements = $('result-achievements');
  var resultAchievementsList = $('result-achievements-list');

  // 成就墙弹窗
  var modalAchWall = $('modal-achievement-wall');
  var achWallList = $('achievement-wall-list');
  var achProgress = $('achievement-progress');
  var achToast = $('achievement-toast');
  var achToastIcon = $('achievement-toast-icon');
  var achToastName = $('achievement-toast-name');

  // 模拟速度控制
  var simSpeed = 'normal';
  var simTimer = null;
  var SIM_DELAYS = { normal: 600, fast: 150, skip: 0 };

  // 模拟完成标记（防止onSimComplete被多次调用）
  var simCompleted = false;

  // ==================== 初始化 ====================
  function init() {
    renderHome();
    GameState.setPage(PAGE_STATE.HOME);
  }

  // ==================== 全局函数暴露 ====================

  /**
   * 随机抽队并进入选秀
   * @param {string} mode - 'league' 或 'cup'
   */
  window.randomTeam = function(mode) {
    if (mode === 'league') {
      GameState.startGame(GAME_MODE.LEAGUE);
    } else {
      GameState.startGame(GAME_MODE.CUP);
    }
    showTeamPreview();
    startDraft();
  };

  /** 进入选秀页 */
  window.startDraft = function() {
    renderDraft();
  };

  /** 跳过模拟/运行全部剩余 */
  window.runSim = function() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
    runSimAll();
  };

  /** 重新开始游戏 */
  window.restartGame = function() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
    // 重置模拟页UI（防止残留进度条/结果列表）
    simResults.innerHTML = '';
    simRecord.textContent = '0-0-0';
    simProgressBar.style.width = '0%';
    simProgressFail.style.width = '0%';
    simRoundLabel.textContent = '第 0/' + (GameState.leagueSimulator ? GameState.leagueSimulator.schedule.length : 38) + ' 轮';
    simPoints.textContent = '0 积分';
    simSpeed = 'normal';
    simCompleted = false;
    // 关闭结算弹窗
    closeResultModal();
    GameState.restart();
    renderHome();
  };

  /** 截图下载 */
  window.captureScreenshot = function() {
    ShareUtil.captureAndDownload(resultCard);
  };

  /** 关闭结算弹窗 */
  window.closeResultModal = function() {
    modalResult.classList.add('hidden');
    modalResult.classList.remove('modal-open');
    document.body.classList.remove('modal-locked');
  };

  /** 切换模拟速度 */
  window.toggleSimSpeed = function() {
    if (simSpeed === 'normal') simSpeed = 'fast';
    else if (simSpeed === 'fast') simSpeed = 'normal';
    btnSimSpeed.innerHTML = simSpeed === 'fast'
      ? '<i class="fa-solid fa-gauge-high mr-1"></i>正常'
      : '<i class="fa-solid fa-forward mr-1"></i>加速';
    if (simTimer) {
      clearInterval(simTimer);
      startSimTimer();
    }
  };

  /** 打开成就墙 */
  window.openAchievementWall = function() {
    renderAchievementWall();
    modalAchWall.classList.remove('hidden');
    modalAchWall.classList.add('modal-open');
    document.body.classList.add('modal-locked');
  };

  /** 关闭成就墙 */
  window.closeAchievementWall = function() {
    modalAchWall.classList.add('hidden');
    modalAchWall.classList.remove('modal-open');
    document.body.classList.remove('modal-locked');
  };

  // ==================== 首页渲染 ====================
  function renderHome() {
    // 最佳战绩
    var best = StorageUtil.getBestRecords();
    var bestLeague = best.league;
    var bestCup = best.cup;
    if ((bestLeague && bestLeague.wins !== undefined) || (bestCup && bestCup.wins !== undefined)) {
      homeBestRecord.classList.remove('hidden');
      var html = '';
      if (bestLeague && bestLeague.wins !== undefined) {
        html += '<div class="flex justify-between items-center">' +
          '<span class="text-gray-400 text-sm">英超最佳</span>' +
          '<span class="text-pitch-400 font-bold">' + bestLeague.wins + '胜' + (bestLeague.draws || 0) + '平' + (bestLeague.loses || 0) + '负</span></div>';
      }
      if (bestCup && bestCup.wins !== undefined) {
        html += '<div class="flex justify-between items-center">' +
          '<span class="text-gray-400 text-sm">国家队最佳</span>' +
          '<span class="text-pitch-400 font-bold">' + bestCup.wins + '胜' + (bestCup.draws || 0) + '平' + (bestCup.loses || 0) + '负</span></div>';
      }
      homeBestRecordContent.innerHTML = html;
    } else {
      homeBestRecord.classList.add('hidden');
    }

    // 已解锁成就
    var unlockedIds = StorageUtil.getAchievements();
    if (unlockedIds.length > 0) {
      homeAchievements.classList.remove('hidden');
      var achHtml = '';
      for (var i = 0; i < unlockedIds.length; i++) {
        var a = ACHIEVEMENTS[unlockedIds[i]];
        if (a) {
          var iconClass = a.icon || 'fa-medal';
          achHtml += '<span class="achievement-badge"><i class="fa-solid ' + iconClass + '"></i>' + a.name + '</span>';
        }
      }
      homeAchievementsContent.innerHTML = achHtml;
    } else {
      homeAchievements.classList.add('hidden');
    }
  }

  /** 显示随机抽队预览 */
  function showTeamPreview() {
    var team = GameState.selectedTeam;
    if (team) {
      homeTeamPreview.classList.remove('hidden');
      homeTeamName.textContent = team.name;
      homeTeamSeason.textContent = team.season || '';
      setTimeout(function() {
        homeTeamPreview.classList.add('hidden');
      }, 2000);
    }
  }

  // ==================== 选修页渲染 ====================
  function startDraft() {
    var ds = GameState.draftSystem;
    if (!ds) return;
    if (!ds.isComplete()) {
      ds.generateOptions();
    }
    renderDraft();
  }

  function renderDraft() {
    var ds = GameState.draftSystem;
    if (!ds) return;

    if (ds.isComplete()) {
      GameState.startSimulation();
      startSimulation();
      return;
    }

    updateDraftInfo();
    renderDraftCards();
    updateFormation();
    updateDraftStats();
    updatePosProgress();
    highlightCurrentSlots();
  }

  function updateDraftInfo() {
    var ds = GameState.draftSystem;
    draftRoundInfo.textContent = '第 ' + (ds.currentRound + 1) + '/11 轮';
    var posGroup = ds.getCurrentPosition();
    var posName = ds.getPositionName(posGroup);
    draftPositionInfo.textContent = '选择' + posName;
    draftProgressBar.style.width = ds.getProgressPercent() + '%';

    var team = GameState.selectedTeam;
    if (team) {
      draftTeamNameEl.textContent = team.name;
      draftTeamSeasonEl.textContent = team.season || '';
    }

    draftHint.innerHTML = '<i class="fa-solid fa-hand-pointer mr-1 text-pitch-400"></i>选择一名' + posName + '加入阵容';
  }

  function renderDraftCards() {
    var ds = GameState.draftSystem;
    var options = ds.currentOptions;
    var posNameMap = { GK: '门将', CB: '中后卫', FB: '边后卫', CDM: '防守中场', CAM: '进攻中场', FW: '前锋' };

    // 空态：候选球员池耗尽
    if (!options || options.length === 0) {
      draftCardsContainer.innerHTML = '<div class="text-center text-gray-500 text-sm py-8 w-full">' +
        '<i class="fa-solid fa-circle-exclamation text-2xl mb-2 block text-amber-500"></i>' +
        '该位置可选球员不足，请重新开始</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < options.length; i++) {
      var p = options[i];
      var posClass = 'pos-tag-' + p.position;
      var posName = posNameMap[p.position] || p.position;
      html += '<div class="player-card" data-index="' + i + '" onclick="selectDraftPlayer(' + i + ')">' +
        '<div class="text-center">' +
          '<span class="inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 ' + posClass + '">' + posName + '</span>' +
          '<h3 class="text-sm font-bold mb-1 truncate">' + p.name + '</h3>' +
          '<p class="text-xs text-gray-400 mb-3 truncate">' + (p.team || '') + '</p>' +
          '<div class="space-y-1 text-xs">' +
            '<div class="flex justify-between"><span class="text-gray-400">综合</span><span class="font-bold text-amber-400">' + p.overall + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-400">进攻</span><span class="font-bold text-red-400">' + p.attack + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-400">防守</span><span class="font-bold text-blue-400">' + p.defense + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-400">拦截</span><span class="font-bold text-green-400">' + p.intercept + '</span></div>' +
          '</div>' +
          (p.isLegend ? '<div class="mt-2 text-xs text-amber-500 font-bold"><i class="fa-solid fa-star mr-1"></i>传奇</div>' : '') +
        '</div>' +
      '</div>';
    }
    draftCardsContainer.innerHTML = html;
  }

  /** 选秀选人（全局函数，供onclick调用） */
  window.selectDraftPlayer = function(index) {
    var ds = GameState.draftSystem;
    var result = ds.selectPlayer(index);
    if (!result) return;

    // 选中金色边框动画：短暂添加card-selected类
    var clickedCard = draftCardsContainer.querySelector('[data-index="' + index + '"]');
    if (clickedCard) {
      clickedCard.classList.add('card-selected');
      // 300ms后跳转下一轮
      setTimeout(function() {
        // 解除选人锁
        ds.unlockSelect();
        if (!ds.isComplete()) {
          ds.generateOptions();
        }
        renderDraft();
      }, 300);
    } else {
      // 解除选人锁
      ds.unlockSelect();
      if (!ds.isComplete()) {
        ds.generateOptions();
      }
      renderDraft();
    }
  };

  function updateFormation() {
    var ds = GameState.draftSystem;
    var selected = ds.getSelectedPlayers();
    var slotMap = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

    var slots = document.querySelectorAll('.formation-slot');
    for (var s = 0; s < slots.length; s++) {
      var label = slots[s].querySelector('.slot-label');
      var pos = slots[s].getAttribute('data-pos');
      slots[s].classList.remove('filled');
      var posNameMap = { GK: '门将', DEF: '后卫', MID: '中场', FWD: '前锋' };
      label.textContent = posNameMap[pos] || pos;
    }

    for (var i = 0; i < selected.length; i++) {
      var player = selected[i];
      var groupMap = { GK: 'GK', CB: 'DEF', FB: 'DEF', CDM: 'MID', CAM: 'MID', FW: 'FWD' };
      var group = groupMap[player.position] || player.position;
      var groupSlots = document.querySelectorAll('.formation-slot[data-pos="' + group + '"]');
      var slotIndex = slotMap[group] || 0;
      if (slotIndex < groupSlots.length) {
        var slot = groupSlots[slotIndex];
        var lbl = slot.querySelector('.slot-label');
        slot.classList.add('filled');
        lbl.textContent = player.name;
        slotMap[group] = slotIndex + 1;
      }
    }
  }

  function updateDraftStats() {
    var ds = GameState.draftSystem;
    if (ds.selectedPlayers.length === 0) {
      draftTeamStats.classList.add('hidden');
      return;
    }
    draftTeamStats.classList.remove('hidden');
    var stat = ds.getTotalTeamStat();
    draftStatPower.textContent = stat.totalPower;
    draftStatAttack.textContent = stat.totalAttack;
    draftStatDefense.textContent = stat.totalDefense;
    draftStatIntercept.textContent = stat.totalIntercept;
  }

  function updatePosProgress() {
    var ds = GameState.draftSystem;
    var groups = ['GK', 'DEF', 'MID', 'FWD'];
    var els = [draftPosGK, draftPosDEF, draftPosMID, draftPosFWD];
    var currentPos = ds.getCurrentPosition();
    for (var i = 0; i < groups.length; i++) {
      var count = ds.getSelectedCountByPosition(groups[i]);
      var required = ds.positionRequired[groups[i]] || 0;
      els[i].textContent = groups[i] + ' ' + count + '/' + required;
      els[i].className = 'text-xs';
      if (groups[i] === currentPos) {
        els[i].classList.add('pos-progress-active');
      } else if (count >= required) {
        els[i].classList.add('pos-progress-done');
      }
    }
  }

  function highlightCurrentSlots() {
    var ds = GameState.draftSystem;
    var posGroup = ds.getCurrentPosition();
    var allSlots = document.querySelectorAll('.formation-slot');
    for (var i = 0; i < allSlots.length; i++) {
      allSlots[i].classList.remove('highlight');
    }
    if (posGroup) {
      var groupSlots = document.querySelectorAll('.formation-slot[data-pos="' + posGroup + '"]');
      for (var j = 0; j < groupSlots.length; j++) {
        if (!groupSlots[j].classList.contains('filled')) {
          groupSlots[j].classList.add('highlight');
        }
      }
    }
  }

  // ==================== 模拟页 ====================
  function startSimulation() {
    simResults.innerHTML = '';
    simRecord.textContent = '0-0-0';
    simProgressBar.style.width = '0%';
    simProgressFail.style.width = '0%';
    simRoundLabel.textContent = '第 0/' + (GameState.leagueSimulator ? GameState.leagueSimulator.schedule.length : 38) + ' 轮';
    simPoints.textContent = '0 积分';
    simSpeed = 'normal';
    simCompleted = false;
    btnSimSpeed.innerHTML = '<i class="fa-solid fa-forward mr-1"></i>加速';
    startSimTimer();
  }

  function startSimTimer() {
    var delay = SIM_DELAYS[simSpeed] || 600;
    simTimer = setInterval(function() {
      var sim = GameState.leagueSimulator;
      if (!sim || sim.isComplete()) {
        clearInterval(simTimer);
        simTimer = null;
        onSimComplete();
        return;
      }
      var result = sim.simulateNextRound();
      if (result) {
        appendSimResult(result);
        updateSimInfo();
        if (sim.isFailed()) {
          clearInterval(simTimer);
          simTimer = null;
          var lastRow = simResults.lastElementChild;
          if (lastRow) lastRow.classList.add('lose-row');
          setTimeout(onSimComplete, 800);
        }
      }
    }, delay);
  }

  function runSimAll() {
    var sim = GameState.leagueSimulator;
    if (!sim) return;
    sim.simulateAllRemaining();
    var results = sim.results;
    simResults.innerHTML = '';
    for (var i = 0; i < results.length; i++) {
      appendSimResult(results[i]);
    }
    updateSimInfo();
    onSimComplete();
  }

  function appendSimResult(result) {
    var row = document.createElement('div');
    row.className = 'sim-row ' + result.result;
    var homeAway = result.isHome ? '主' : '客';
    var resultLabel = result.result === 'win' ? '胜' : (result.result === 'draw' ? '平' : '负');
    var resultColor = result.result === 'win' ? 'text-green-400' : (result.result === 'draw' ? 'text-yellow-400' : 'text-red-400');
    var roundNum = result.round || (GameState.leagueSimulator.results.length);
    row.innerHTML =
      '<span class="text-gray-500 text-xs w-8">R' + roundNum + '</span>' +
      '<span class="text-xs w-6 ' + (result.isHome ? 'text-pitch-400' : 'text-gray-500') + '">' + homeAway + '</span>' +
      '<span class="flex-1 text-sm truncate ml-1">' + result.opponent.name + '</span>' +
      '<span class="text-sm font-bold mx-2">' + result.myGoals + '-' + result.oppGoals + '</span>' +
      '<span class="text-xs font-bold ' + resultColor + '">' + resultLabel + '</span>';
    simResults.appendChild(row);
    simResults.scrollTop = simResults.scrollHeight;
  }

  function updateSimInfo() {
    var sim = GameState.leagueSimulator;
    if (!sim) return;
    simRecord.textContent = sim.getRecordString();
    simProgressBar.style.width = sim.getProgressPercent() + '%';
    simRoundLabel.textContent = '第 ' + sim.currentRound + '/' + sim.schedule.length + ' 轮';
    var points = sim.record.win * 3 + sim.record.draw * 1;
    simPoints.textContent = points + ' 积分';
    if (sim.isFailed()) {
      simProgressFail.style.width = sim.getProgressPercent() + '%';
    }
  }

  function onSimComplete() {
    // 防止重复调用（isComplete和isFailed两条路径可能都触发）
    if (simCompleted) return;
    simCompleted = true;

    GameState.showResult();
    renderResult();
  }

  // ==================== 结算弹窗 ====================
  function renderResult() {
    var result = GameState.finalResult;
    if (!result) return;

    // 重置样式
    resultCard.classList.remove('result-perfect');
    resultPerfectBadge.classList.add('hidden');
    resultRecord.className = 'text-6xl font-black mb-2 tracking-wider';
    resultRecord.textContent = result.record;

    if (result.isPerfect) {
      resultPerfectBadge.classList.remove('hidden');
      resultRecord.className = 'text-6xl font-black mb-2 tracking-wider result-perfect-text';
      resultStatus.textContent = '完美赛季!';
      resultStatus.className = 'text-lg mb-1 text-amber-400 font-bold';
      resultSubtitle.textContent = '你达成了不可思议的38-0-0!';
      resultSubtitle.className = 'text-sm text-amber-300/60';
      resultCard.classList.add('result-perfect');
    } else if (result.isFailed) {
      resultRecord.className = 'text-6xl font-black mb-2 tracking-wider text-red-400';
      resultStatus.textContent = '挑战失败';
      resultStatus.className = 'text-lg mb-1 text-red-400 font-bold';
      resultSubtitle.textContent = '只要出现平局或输球即挑战失败';
      resultSubtitle.className = 'text-sm text-gray-500';
    } else {
      resultRecord.className = 'text-6xl font-black mb-2 tracking-wider text-pitch-400';
      resultStatus.textContent = '赛季结束';
      resultStatus.className = 'text-lg mb-1 text-pitch-400 font-bold';
      resultSubtitle.textContent = '';
      resultSubtitle.className = 'text-sm text-gray-500';
    }

    // 失败信息
    if (result.failInfo) {
      resultFailInfo.classList.remove('hidden');
      var homeAway = result.failInfo.isHome ? '主场' : '客场';
      resultFailText.textContent = '第' + result.failInfo.round + '轮 ' + homeAway + ' vs ' + result.failInfo.opponent + ' 比分 ' + result.failInfo.score;
    } else {
      resultFailInfo.classList.add('hidden');
    }

    // 赛季数据
    resultStatWins.textContent = result.wins || 0;
    resultStatDraws.textContent = result.draws || 0;
    resultStatLoses.textContent = result.loses || 0;
    resultStatPoints.textContent = result.points || 0;
    resultStatRank.textContent = result.rank ? '#' + result.rank : '-';

    // 阵容展示
    var posNameMap = { GK: '门将', CB: '中后卫', FB: '边后卫', CDM: '防守中场', CAM: '进攻中场', FW: '前锋' };
    var team = result.team;
    var playersHtml = '';
    if (team && team.players) {
      for (var i = 0; i < team.players.length; i++) {
        var p = team.players[i];
        var posClass = 'pos-tag-' + p.position;
        var posName = posNameMap[p.position] || p.position;
        playersHtml += '<div class="flex items-center gap-1">' +
          '<span class="px-1 rounded text-xs ' + posClass + '">' + posName + '</span>' +
          '<span class="truncate">' + p.name + '</span>' +
          '<span class="text-gray-500 ml-auto">' + p.overall + '</span>' +
        '</div>';
      }
    }
    resultTeamPlayers.innerHTML = playersHtml;

    // 成就解锁
    if (GameState.newAchievements && GameState.newAchievements.length > 0) {
      resultAchievements.classList.remove('hidden');
      var achHtml = '';
      for (var j = 0; j < GameState.newAchievements.length; j++) {
        var ach = GameState.newAchievements[j];
        var achIcon = ach.icon || 'fa-trophy';
        achHtml += '<div class="text-amber-300 text-xs"><i class="fa-solid ' + achIcon + ' mr-1"></i>' + ach.name + ' - ' + ach.desc + '</div>';
      }
      resultAchievementsList.innerHTML = achHtml;
      // 弹出金色成就提示动画
      showAchievementToasts(GameState.newAchievements);
    } else {
      resultAchievements.classList.add('hidden');
    }

    // 显示弹窗 + 锁定底层滚动
    modalResult.classList.remove('hidden');
    modalResult.classList.add('modal-open');
    document.body.classList.add('modal-locked');
  }

  // ==================== 成就墙 ====================

  /** 渲染成就墙列表 */
  function renderAchievementWall() {
    var unlockedIds = StorageUtil.getAchievements();
    var allKeys = Object.keys(ACHIEVEMENTS);
    var total = allKeys.length;
    var unlocked = unlockedIds.length;
    achProgress.textContent = '已解锁 ' + unlocked + '/' + total;

    var html = '';
    for (var i = 0; i < allKeys.length; i++) {
      var key = allKeys[i];
      var ach = ACHIEVEMENTS[key];
      var isUnlocked = unlockedIds.indexOf(key) !== -1;
      var iconClass = ach.icon || 'fa-medal';
      var itemClass = isUnlocked ? 'ach-wall-item unlocked' : 'ach-wall-item locked';

      html += '<div class="' + itemClass + '">' +
        '<div class="ach-wall-icon"><i class="fa-solid ' + iconClass + '"></i></div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-sm font-bold ' + (isUnlocked ? 'text-amber-400' : 'text-gray-500') + '">' + ach.name + '</div>' +
          '<div class="text-xs ' + (isUnlocked ? 'text-gray-300' : 'text-gray-600') + '">' + ach.desc + '</div>' +
        '</div>' +
        (isUnlocked ? '<i class="fa-solid fa-check-circle text-amber-400"></i>' : '<i class="fa-solid fa-lock text-gray-600"></i>') +
      '</div>';
    }
    achWallList.innerHTML = html;
  }

  /** 成就解锁金色提示动画（逐个弹出） */
  function showAchievementToasts(achievements) {
    if (!achievements || achievements.length === 0) return;
    for (var i = 0; i < achievements.length; i++) {
      (function(ach, delay) {
        setTimeout(function() {
          var iconClass = ach.icon || 'fa-crown';
          achToastIcon.className = 'fa-solid ' + iconClass + ' text-amber-400 text-xl';
          achToastName.textContent = ach.name + ' - ' + ach.desc;
          // 重置动画：先移除再添加
          achToast.classList.add('hidden');
          // 强制重排以重启动画
          void achToast.offsetWidth;
          achToast.classList.remove('hidden');
          // 3秒后自动隐藏
          setTimeout(function() {
            achToast.classList.add('hidden');
          }, 3000);
        }, delay);
      })(achievements[i], i * 800);
    }
  }

  // ==================== 启动 ====================
  document.addEventListener('DOMContentLoaded', init);
})();
