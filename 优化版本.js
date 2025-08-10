// ==UserScript==
// @name         TOOL Pro Core
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  支持视频自动切换、强制播放、自动确认随机检测点
// @author       XJY
// @match        https://*.ewt360.com/*
// @license      MIT
// @icon         https://th.bing.com/th?id=ODLS.8f71fab6-d8fc-43f3-a56d-53f87a14d5c8&amp;w=32&amp;h=32&amp;qlt=90&amp;pcl=fffffa&amp;o=6&amp;pid=1.2
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @downloadURL  https://update.greasyfork.org/scripts/524327/%E5%8D%87%E5%AD%A6e%E7%BD%91%E9%80%9A%E5%88%B7%E8%AF%BE%E8%84%9A%E6%9C%AC.user.js
// @updateURL    https://update.greasyfork.org/scripts/524327/%E5%8D%87%E5%AD%A6e%E7%BD%91%E9%80%9A%E5%88%B7%E8%AF%BE%E8%84%9A%E6%9C%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 配置常量
    const CONFIG = {
        MAX_RETRY: 5,             // 最大重试次数
        RETRY_INTERVAL: 1000,     // 重试间隔(ms)
        UI_CHECK_INTERVAL: 3000,  // UI检查间隔(ms)
        INIT_RETRY_DELAY: 500     // 初始重试延迟(ms)
    };
    
    // 全局变量
    let modal = null;
    let messageList = null;
    let initAttempts = 0;
    let currentVideo = null;
    let title = "初始标题";
    
    // 功能开关（带存储功能）
    const FEATURES = {
        FORCE_PLAY: GM_getValue("forcePlayEnabled", true),
        AUTO_SKIP: GM_getValue("autoSkipEnabled", true),
        AUTO_CONFIRM: GM_getValue("autoConfirmEnabled", true)
    };
    
    // 添加全局样式
    GM_addStyle(`
        #draggableModal {
            position: fixed;
            top: 50px;
            left: 50px;
            width: 380px;
            height: 300px;
            background-color: #111;
            border: 1px solid #00cc00;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.7);
            z-index: 100000;
            overflow: hidden;
            user-select: none;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border-radius: 8px;
            transition: all 0.3s ease;
        }
        
        .modal-header {
            background: linear-gradient(to right, #002200, #001100);
            padding: 10px 15px;
            cursor: move;
            color: #00ff00;
            font-weight: bold;
            border-bottom: 1px solid #00cc00;
            text-align: center;
            position: relative;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-title {
            font-size: 18px;
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.8);
        }
        
        .modal-controls {
            display: flex;
            gap: 8px;
        }
        
        .modal-btn {
            padding: 5px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.2s;
        }
        
        .modal-btn.primary {
            background: #28a745;
            color: white;
        }
        
        .modal-btn.danger {
            background: #dc3545;
            color: white;
        }
        
        .modal-btn.secondary {
            background: #6c757d;
            color: white;
        }
        
        .modal-btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        .modal-btn:active {
            transform: translateY(1px);
        }
        
        #messageList {
            height: 250px;
            overflow-y: auto;
            padding: 15px;
            color: #00ff00;
            background-color: #000;
            font-size: 14px;
            line-height: 1.5;
        }
        
        #messageList::-webkit-scrollbar {
            width: 8px;
        }
        
        #messageList::-webkit-scrollbar-track {
            background: #000;
        }
        
        #messageList::-webkit-scrollbar-thumb {
            background: #00cc00;
            border-radius: 4px;
        }
        
        .message-item {
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 4px;
            background-color: rgba(0, 30, 0, 0.3);
            word-break: break-word;
            animation: fadeIn 0.3s ease;
            border-left: 3px solid #00cc00;
        }
        
        .message-item.warning {
            background-color: rgba(173, 167, 0, 0.2);
            border-left: 3px solid #ffcc00;
            color: #ffcc00;
        }
        
        .message-item.error {
            background-color: rgba(173, 0, 0, 0.2);
            border-left: 3px solid #ff3333;
            color: #ff6666;
        }
        
        .message-item.success {
            background-color: rgba(0, 100, 0, 0.3);
            border-left: 3px solid #33ff66;
            color: #33ff66;
        }
        
        .message-item.info {
            background-color: rgba(0, 50, 100, 0.3);
            border-left: 3px solid #3399ff;
            color: #3399ff;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `);
    
    // 工具函数
    const Utils = {
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        addMessage: (msg, type = "normal") => {
            if (!messageList) return;
            
            const message = document.createElement('div');
            message.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            message.className = `message-item ${type}`;
            
            messageList.appendChild(message);
            messageList.scrollTop = messageList.scrollHeight;
        },
        
        log: (msg, type = "info") => {
            console.log(`[TOOL Pro] ${msg}`);
            Utils.addMessage(msg, type);
        },
        
        getTitle: () => {
            const titleText = document.querySelector('div[class="title-1dNOi"]');
            return titleText ? titleText.textContent.trim() : "";
        },
        
        getCheckButton: () => {
            return document.querySelector('span[class="btn-3LStS"]');
        },
        
        async getVideoList() {
            let divVideoList = null;
            for (let cnt = 1; cnt <= 5; cnt++) {
                divVideoList = document.querySelector('div[class="listCon-N9Rlm"]');
                if (divVideoList) break;
                await Utils.wait(1000);
            }

            return divVideoList ? Array.from(divVideoList.children) : null;
        }
    };
    
    // 创建悬浮窗函数
    function createDraggableModal() {
        try {
            // 如果已经存在，直接返回
            if (document.getElementById('draggableModal')) {
                return true;
            }
            
            // 创建悬浮窗容器
            modal = document.createElement('div');
            modal.id = 'draggableModal';
            
            // 标题栏
            const titleBar = document.createElement('div');
            titleBar.className = 'modal-header';
            
            const titleText = document.createElement('div');
            titleText.className = 'modal-title';
            titleText.textContent = 'TOOL Pro Core';
            
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'modal-controls';
            
            // 创建功能开关按钮
            const createFeatureButton = (featureName, text, colorClass) => {
                const button = document.createElement('button');
                button.className = `modal-btn ${colorClass}`;
                button.textContent = FEATURES[featureName] ? `${text}:ON` : `${text}:OFF`;
                button.style.backgroundColor = FEATURES[featureName] ? '#28a745' : '#dc3545';
                button.title = `点击${FEATURES[featureName] ? '禁用' : '启用'}${text}`;
                
                button.addEventListener('click', () => {
                    FEATURES[featureName] = !FEATURES[featureName];
                    GM_setValue(`${featureName}Enabled`, FEATURES[featureName]);
                    button.textContent = FEATURES[featureName] ? `${text}:ON` : `${text}:OFF`;
                    button.style.backgroundColor = FEATURES[featureName] ? '#28a745' : '#dc3545';
                    Utils.log(`${text}功能已${FEATURES[featureName] ? '开启' : '关闭'}`, "info");
                });
                
                return button;
            };
            
            // 添加功能按钮（精简版只保留核心功能）
            const forcePlayBtn = createFeatureButton('FORCE_PLAY', '强制播放', 'primary');
            const autoSkipBtn = createFeatureButton('AUTO_SKIP', '自动跳过', 'primary');
            const autoConfirmBtn = createFeatureButton('AUTO_CONFIRM', '自动确认', 'primary');
            
            // 清屏按钮
            const clearBtn = document.createElement('button');
            clearBtn.className = 'modal-btn secondary';
            clearBtn.textContent = '清屏';
            clearBtn.title = '清除所有消息';
            clearBtn.addEventListener('click', () => {
                messageList.innerHTML = '';
                Utils.log("消息已清空", "info");
            });
            
            // 组装控件
            controlsContainer.appendChild(forcePlayBtn);
            controlsContainer.appendChild(autoSkipBtn);
            controlsContainer.appendChild(autoConfirmBtn);
            controlsContainer.appendChild(clearBtn);
            
            titleBar.appendChild(titleText);
            titleBar.appendChild(controlsContainer);
            
            // 消息列表
            messageList = document.createElement('div');
            messageList.id = 'messageList';
            
            // 组装悬浮窗
            modal.appendChild(titleBar);
            modal.appendChild(messageList);
            
            // 添加到文档
            document.body.appendChild(modal);
            
            // 添加欢迎消息
            Utils.log("TOOL Pro Core 已启动", "success");
            Utils.log("悬浮窗创建成功！", "success");
            
            // 添加拖动功能
            let isDragging = false;
            let offsetX, offsetY;
            
            titleBar.addEventListener('mousedown', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                
                isDragging = true;
                offsetX = e.clientX - modal.offsetLeft;
                offsetY = e.clientY - modal.offsetTop;
                modal.style.cursor = 'grabbing';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            
            function onMouseMove(e) {
                if (!isDragging) return;
                
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                
                // 限制在视口范围内
                const maxX = window.innerWidth - modal.offsetWidth;
                const maxY = window.innerHeight - modal.offsetHeight;
                
                modal.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
                modal.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
            }
            
            function onMouseUp() {
                isDragging = false;
                modal.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            
            return true;
        } catch (error) {
            // 错误处理
            Utils.log(`悬浮窗创建失败: ${error}`, "error");
            return false;
        }
    }
    
    // 带重试的悬浮窗初始化
    function initModalWithRetry() {
        initAttempts++;
        
        try {
            if (createDraggableModal()) {
                Utils.log(`悬浮窗在第${initAttempts}次尝试后成功创建`, "success");
                return true;
            }
        } catch (error) {
            Utils.log(`悬浮窗创建尝试${initAttempts}失败: ${error}`, "error");
        }
        
        if (initAttempts < CONFIG.MAX_RETRY) {
            Utils.log(`悬浮窗创建失败，${CONFIG.RETRY_INTERVAL}ms后重试...`, "warning");
            setTimeout(initModalWithRetry, CONFIG.RETRY_INTERVAL);
        } else {
            Utils.log(`悬浮窗创建失败，已尝试${CONFIG.MAX_RETRY}次`, "error");
        }
        return false;
    }
    
    // 确保悬浮窗存在的函数
    function ensureModalExists() {
        if (!document.getElementById('draggableModal')) {
            Utils.log("检测到悬浮窗不存在，尝试重新创建", "warning");
            initModalWithRetry();
        }
    }
    
    // 强制播放功能
    function forcePlayAction() {
        if (!FEATURES.FORCE_PLAY) return;
        
        // 1. 处理暂停弹窗
        const pauseModal = document.querySelector('#earnest_check_unpass_play > p:nth-child(1) > img');
        if (pauseModal) {
            pauseModal.click();
            Utils.log("检测到暂停弹窗，自动继续播放", "info");
        }

        // 2. 处理跳过题目按钮
        const video = document.querySelector('video[class="vjs-tech"]');
        if (video) {
            const skipButton = document.querySelector(`#vjs_video_${video.id.split('_')[2]} > div.video-interactive-layer > div > div > div.question-combition > div.skip-container > div.btn.action-skip`);
            if (skipButton) {
                skipButton.click();
                Utils.log("检测到题目，自动跳过", "info");
            }
        }

        // 3. 处理一心多用弹窗
        for (let k = 0; k < 100; k++) {
            const modal = document.querySelector(`body > div:nth-child(${k}) > div > div.ant-modal-wrap > div > div.ant-modal-content > div`);
            if (modal) {
                const confirmBtn = modal.querySelector('div > div.ant-modal-confirm-btns > button');
                if (confirmBtn) {
                    confirmBtn.click();
                    Utils.log("检测到弹窗，自动关闭", "info");
                }
            }
        }

        // 4. 强制播放视频
        if (currentVideo && currentVideo.paused) {
            currentVideo.play();
            Utils.log("视频已暂停，强制继续播放", "info");
        }
    }
    
    // 视频结束处理
    async function handleVideoEnd() {
        Utils.log("视频播放结束，准备切换!", "info");
        
        const videoList = await Utils.getVideoList();
        if (!videoList) {
            Utils.log("获取视频列表失败!", "error");
            return;
        }
        
        for (let i = 0; i < videoList.length - 1; i++) {
            const div = videoList[i];
            const divTitle = div.querySelector('div[class="lessontitle-x9B-7"]')?.textContent?.trim();
            
            if (divTitle === title) {
                if (i >= videoList.length - 2) {
                    Utils.log("已经到课程结尾!", "warning");
                    return;
                }
                
                Utils.log(`切换到下一个视频: ${videoList[i+1].querySelector('div[class="lessontitle-x9B-7"]')?.textContent?.trim()}`, "success");
                videoList[i + 1].click();
                return;
            }
        }
        
        Utils.log("未找到匹配的视频标题", "error");
    }
    
    // 检测按钮处理
    function handleCheckButton() {
        const checkButton = Utils.getCheckButton();
        if (checkButton != null) {
            checkButton.click();
            Utils.log("找到检测按钮，自动点击!", "info");
        }
    }
    
    // 主初始化函数
    function mainInit() {
        // 初始创建尝试
        setTimeout(() => {
            initModalWithRetry();
        }, CONFIG.INIT_RETRY_DELAY);
        
        // 设置定期检查
        setInterval(ensureModalExists, CONFIG.UI_CHECK_INTERVAL);
        
        // 强制播放检测
        setInterval(forcePlayAction, 1000);
        
        // 检测按钮检查
        setInterval(handleCheckButton, 2000);
        
        // 页面URL变化检测
        let lastHref = location.href;
        setInterval(() => {
            if (lastHref !== location.href) {
                Utils.log("检测到页面URL变化，重新初始化", "warning");
                lastHref = location.href;
                initModalWithRetry();
            }
        }, 1000);
        
        // 视频监控
        setInterval(async () => {
            const newTitle = Utils.getTitle();
            if (title !== newTitle) {
                Utils.log(`检测到视频切换: ${newTitle}`, "info");
                title = newTitle;

                await Utils.wait(1000);
                currentVideo = document.querySelector('video[class="vjs-tech"]');

                if (currentVideo) {
                    currentVideo.addEventListener('ended', handleVideoEnd);
                }
            }
        }, 2000);
    }
    
    // 启动脚本 - 多重事件保障
    const initEvents = ['DOMContentLoaded', 'load', 'pageshow'];
    
    initEvents.forEach(event => {
        window.addEventListener(event, mainInit);
    });
    
    // 如果文档已加载，立即初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        mainInit();
    }
})();