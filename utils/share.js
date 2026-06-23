/**
 * ShareUtil 截图分享工具
 * 基于html2canvas实现结算弹窗截图与下载
 * 适配手机/电脑浏览器，解决移动端截图模糊问题
 * 编码: UTF-8
 */
var ShareUtil = {
  /**
   * 检测html2canvas是否可用
   * @returns {boolean}
   */
  _isHtml2CanvasReady: function() {
    return typeof html2canvas === 'function';
  },

  /**
   * 获取设备像素比（解决移动端截图模糊问题）
   * 移动端devicePixelRatio通常为2或3，桌面端为1
   * @returns {number}
   */
  _getDeviceScale: function() {
    var dpr = window.devicePixelRatio || 1;
    // 限制最大3倍，避免生成过大图片导致内存溢出
    return Math.min(dpr, 3);
  },

  /**
   * 截取结算弹窗DOM，返回Canvas对象
   * 2倍高清画质，适配移动端高DPI屏幕
   * @param {HTMLElement} element - 要截图的DOM元素
   * @param {Object} [options] - 截图选项
   * @param {number} [options.scale] - 缩放倍率，默认取设备像素比（最小2倍）
   * @param {string} [options.backgroundColor] - 背景色，默认'#111827'
   * @returns {Promise<HTMLCanvasElement>} 截图Canvas
   */
  captureResultScreen: function(element, options) {
    if (!this._isHtml2CanvasReady()) {
      alert('截图功能加载失败，请刷新页面重试');
      return Promise.reject(new Error('html2canvas未加载'));
    }

    if (!element) {
      alert('截图目标不存在，请重试');
      return Promise.reject(new Error('截图DOM元素为空'));
    }

    // 合并默认选项
    var opts = options || {};
    var scale = opts.scale || Math.max(2, this._getDeviceScale());
    var bgColor = opts.backgroundColor || '#111827';

    return html2canvas(element, {
      backgroundColor: bgColor,
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // 移动端优化：移除滚动偏移导致的截图偏移
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    }).catch(function(err) {
      console.error('[ShareUtil] 截图失败:', err);
      alert('截图失败，请重试');
      throw err;
    });
  },

  /**
   * 自动下载PNG图片，文件名带赛季战绩
   * @param {HTMLCanvasElement} canvas - 截图Canvas
   * @param {string} [filename] - 文件名（不含扩展名），默认'38-0-0_战绩_时间戳'
   */
  downloadImage: function(canvas, filename) {
    if (!canvas) return;

    // 生成文件名：38-0-0_战绩_时间戳
    var name = filename || ('38-0-0_' + this._generateFilename());
    var fullFilename = name + '.png';

    try {
      // 优先使用toBlob + URL.createObjectURL（移动端兼容性更好）
      canvas.toBlob(function(blob) {
        if (blob) {
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.download = fullFilename;
          link.href = url;
          // 触发下载
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // 延迟释放URL，确保下载完成
          setTimeout(function() {
            URL.revokeObjectURL(url);
          }, 1000);
        } else {
          // blob创建失败，回退到dataURL方式
          ShareUtil._downloadViaDataURL(canvas, fullFilename);
        }
      }, 'image/png');
    } catch (e) {
      // toBlob不可用时回退到dataURL方式
      this._downloadViaDataURL(canvas, fullFilename);
    }
  },

  /**
   * 通过dataURL方式下载图片（兜底方案）
   * @param {HTMLCanvasElement} canvas
   * @param {string} filename
   */
  _downloadViaDataURL: function(canvas, filename) {
    try {
      var link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('下载失败，请长按截图保存');
    }
  },

  /**
   * 生成文件名中的战绩+时间戳部分
   * 从GameState.finalResult读取战绩，格式如 "30-5-3_1718600000"
   * @returns {string}
   */
  _generateFilename: function() {
    var record = 'unknown';
    try {
      if (typeof GameState !== 'undefined' && GameState.finalResult) {
        record = GameState.finalResult.record || 'unknown';
      }
    } catch (e) {
      // GameState不可用时使用默认值
    }
    return record + '_' + Date.now();
  },

  /**
   * 截图并下载（一站式调用）
   * 保留原有接口兼容性，app.js中captureScreenshot调用此方法
   * @param {HTMLElement} element - 要截图的DOM元素
   */
  captureAndDownload: function(element) {
    if (!this._isHtml2CanvasReady()) {
      alert('截图功能加载失败，请刷新页面重试');
      return;
    }

    var self = this;
    this.captureResultScreen(element).then(function(canvas) {
      self.downloadImage(canvas);
    }).catch(function() {
      // captureResultScreen内部已弹窗提示，此处不再重复
    });
  }
};
