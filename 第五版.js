// ==UserScript==
// @name         TOOL
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  支持视频自动切换、强制播放、自动确认随机检测点
// @author       XJY
// @match        https://*.ewt360.com/*
// @license      MIT
// @icon         https://th.bing.com/th?id=ODLS.8f71fab6-d8fc-43f3-a56d-53f87a14d5c8&amp;w=32&amp;h=32&amp;qlt=90&amp;pcl=fffffa&amp;o=6&amp;pid=1.2
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/524327/%E5%8D%87%E5%AD%A6e%E7%BD%91%E9%80%9A%E5%88%B7%E8%AF%BE%E8%84%9A%E6%9C%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/524327/%E5%8D%87%E5%AD%A6e%E7%BD%91%E9%80%9A%E5%88%B7%E8%AF%BE%E8%84%9A%E6%9C%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';
    const MaxTryNum = 3;

    let modal = null;
    let titleBar = null;
    let messageList = null;
    let forcePlayEnabled = true; // 强制播放功能开关
    let currentVideo = null;
    let videoId = ""; // 视频播放器ID
    let testId = ""; // 测试ID
    let lastHref = location.href; // 记录当前URL

    // 修改标题为"TOOL"
    let DraggableModalTitle = "TOOL";

    function Wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function GetCheckButton() {
        let button = document.querySelector('span[class="btn-3LStS"]');
        return button;
    }

    function GetTitle() {
        let titleText = document.querySelector('div[class="title-1dNOi"]');
        let text = '';
        if (titleText) {
            Array.from(titleText.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent.trim();
                }
            });
        }
        return text;
    }

    async function GetVideoList() {
        addMessage("开始获取视频列表!");
        let divVideoList = document.querySelector('div[class="listCon-N9Rlm"]');
        for (let cnt = 1; divVideoList == null && cnt <= MaxTryNum; cnt++) {
            divVideoList = document.querySelector('div[class="listCon-N9Rlm"]');
            addMessage("尝试获取失败,重试中!");
            await Wait(1000);
        }

        let videoList = divVideoList ? divVideoList.children : null;

        if (videoList != null) {
            addMessage("获取视频列表成功！");
            return videoList;
        } else {
            addMessage("获取视频列表失败！");
            return null;
        }
    }

    async function CatchVideo() {
        let video = document.querySelector('video[class="vjs-tech"]');
        for (let cnt = 1; video == null && cnt <= MaxTryNum; cnt++) {
            video = document.querySelector('video[class="vjs-tech"]');
            addMessage("尝试获取video失败,重试中!");
            await Wait(1000);
        }

        if (video) {
            addMessage("获取video成功!");
            return video;
        }
        return null;
    }

    // 查找视频播放器ID
    function FindVideoId() {
        if (videoId) return videoId;

        for (let i = 0; i < 20; i++) {
            const player = document.querySelector(`#vjs_video_${i}`);
            if (player) {
                videoId = i.toString();
                addMessage(`找到视频播放器 ID: ${videoId}`);
                return videoId;
            }
        }
        return "";
    }

    // 查找测试ID
    function FindTestId() {
        if (testId) return testId;

        for (let i = 0; i < 1000; i++) {
            const testElem = document.querySelector(`#rc-tabs-${i}-panel-1 > div > ul > div > li > div > div.course_chapter_btn_box > a > p`);
            if (testElem) {
                testId = i.toString();
                addMessage(`找到测试ID: ${testId}`);
                return testId;
            }
        }
        return "";
    }

    // 执行强制播放功能
    function ForcePlayAction() {
        if (!forcePlayEnabled) return;

        // 处理暂停弹窗
        const pauseModal = document.querySelector('#earnest_check_unpass_play > p:nth-child(1) > img');
        if (pauseModal) {
            addMessage("检测到暂停弹窗，自动继续播放");
            pauseModal.click();
        }

        // 处理跳过题目按钮
        const videoId = FindVideoId();
        if (videoId) {
            const skipButton = document.querySelector(`#vjs_video_${videoId} > div.video-interactive-layer > div > div > div.question-combition > div.skip-container > div.btn.action-skip`);
            if (skipButton) {
                addMessage("检测到题目，自动跳过");
                skipButton.click();
            }
        }

        // 处理一心多用弹窗
        for (let k = 0; k < 100; k++) {
            const modal = document.querySelector(`body > div:nth-child(${k}) > div > div.ant-modal-wrap > div > div.ant-modal-content > div`);
            if (modal) {
                const confirmBtn = modal.querySelector('div > div.ant-modal-confirm-btns > button');
                if (confirmBtn) {
                    addMessage("检测到弹窗，自动关闭");
                    confirmBtn.click();
                    const playBtn = document.querySelector(`#vjs_video_${videoId} > button`);
                    if (playBtn) playBtn.click();
                }
            }
        }

        // 强制播放视频
        if (currentVideo && currentVideo.paused) {
            addMessage("视频已暂停，强制继续播放");
            currentVideo.play();
        }
    }

    async function Next(title) {
        await Wait(3000);

        let videoList = await GetVideoList();
        if (!videoList) return;

        addMessage(title);
        for (let i = 0; i < videoList.length - 1; i++) {
            let div = videoList[i];
            let divTitle = div.querySelector('div[class="lessontitle-x9B-7"]').textContent;
            addMessage(divTitle);
            if (divTitle == title) {
                if (i >= videoList.length - 2) {
                    addMessage("已经到结尾!");
                    return;
                }
                addMessage("切换到下一个视频");
                videoList[i + 1].click();
            }
        }
    }

    // 确保悬浮窗存在的函数
    function ensureModalExists() {
        if (!document.getElementById('draggableModal')) {
            addMessage("检测到悬浮窗不存在，重新创建");
            createDraggableModal();
        }
    }

    // 创建可拖动的悬浮窗
    function createDraggableModal() {
        // 移除已存在的悬浮窗（确保每个页面只有一个）
        const oldModal = document.getElementById('draggableModal');
        if (oldModal) {
            oldModal.remove();
        }

        // 创建新的悬浮窗
        modal = document.createElement('div');
        modal.id = 'draggableModal';
        modal.style.position = 'fixed';
        modal.style.top = '50px';
        modal.style.left = '50px';
        modal.style.width = '350px';
        modal.style.height = '350px';
        modal.style.backgroundColor = '#000';
        modal.style.border = '1px solid #00cc00';
        modal.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
        modal.style.zIndex = '100000';
        modal.style.overflow = 'hidden';
        modal.style.userSelect = 'none';
        modal.style.fontFamily = 'Consolas, "Courier New", monospace';

        // 消息列表
        messageList = document.createElement('div');
        messageList.id = 'messageList';
        messageList.style.height = '300px';
        messageList.style.overflowY = 'auto';
        messageList.style.padding = '10px';
        messageList.style.color = '#00ff00';
        messageList.style.backgroundColor = '#000';
        messageList.style.borderBottom = '1px solid #00cc00';
        
        // 自定义滚动条样式
        messageList.style.scrollbarWidth = 'thin';
        messageList.style.scrollbarColor = '#00cc00 #000';
        messageList.innerHTML = '<style>\
            #messageList::-webkit-scrollbar { width: 8px; }\
            #messageList::-webkit-scrollbar-track { background: #000; }\
            #messageList::-webkit-scrollbar-thumb { background: #00cc00; border-radius: 4px; }\
        </style>';

        // 标题栏
        titleBar = document.createElement('div');
        titleBar.style.backgroundColor = '#002200';
        titleBar.style.padding = '10px';
        titleBar.style.cursor = 'move';
        titleBar.style.color = '#00ff00';
        titleBar.style.fontWeight = 'bold';
        titleBar.style.borderBottom = '1px solid #00cc00';
        titleBar.style.textAlign = 'center';
        titleBar.style.position = 'relative';
        titleBar.textContent = DraggableModalTitle;

        // 添加开关按钮
        const toggleButton = document.createElement('button');
        toggleButton.id = 'forcePlayToggle';
        toggleButton.textContent = forcePlayEnabled ? '强制播放:ON' : '强制播放:OFF';
        toggleButton.style.position = 'absolute';
        toggleButton.style.right = '10px';
        toggleButton.style.top = '50%';
        toggleButton.style.transform = 'translateY(-50%)';
        toggleButton.style.backgroundColor = forcePlayEnabled ? '#28a745' : '#dc3545';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '3px';
        toggleButton.style.padding = '3px 10px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.fontSize = '12px';
        toggleButton.style.fontWeight = 'bold';

        toggleButton.addEventListener('click', function() {
            forcePlayEnabled = !forcePlayEnabled;
            toggleButton.textContent = forcePlayEnabled ? '强制播放:ON' : '强制播放:OFF';
            toggleButton.style.backgroundColor = forcePlayEnabled ? '#28a745' : '#dc3545';
            addMessage(`强制播放功能已${forcePlayEnabled ? '开启' : '关闭'}`);
        });

        titleBar.appendChild(toggleButton);

        // 组装元素
        modal.appendChild(titleBar);
        modal.appendChild(messageList);

        // 添加到文档
        document.body.appendChild(modal);

        // 拖动功能
        let isDragging = false;
        let offsetX, offsetY;

        titleBar.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - modal.offsetLeft;
            offsetY = e.clientY - modal.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (isDragging) {
                modal.style.left = (e.clientX - offsetX) + 'px';
                modal.style.top = (e.clientY - offsetY) + 'px';
            }
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    function addMessage(msg) {
        // 确保悬浮窗存在
        if (!messageList) {
            createDraggableModal();
        }
        
        var message = document.createElement('div');
        message.textContent = msg;
        message.style.marginBottom = '5px';
        message.style.wordBreak = 'break-word';
        messageList.appendChild(message);
        messageList.scrollTop = messageList.scrollHeight;
    }

    // 禁止空格键翻页
    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 32) {
            e.preventDefault();
        }
    });

    async function Loading() {
        await Wait(2000);
        
        // 创建悬浮窗
        createDraggableModal();
        
        // 设置定时器定期检查悬浮窗是否存在
        setInterval(ensureModalExists, 3000);
        
        addMessage("脚本已启动，正在初始化...");
        addMessage("强制播放功能已启用");

        let title = "初始标题";

        // 页面URL变化检测
        setInterval(() => {
            if (lastHref !== location.href) {
                addMessage("检测到页面URL变化，重新初始化");
                lastHref = location.href;
                videoId = "";
                testId = "";
                currentVideo = null;
            }
        }, 1000);

        // 强制播放检测
        setInterval(ForcePlayAction, 1000);

        while (true) {
            await Wait(1000);

            let newTitle = GetTitle();
            if (title !== newTitle) {
                addMessage("检测到视频切换!");
                title = newTitle;

                await Wait(1000);
                currentVideo = await CatchVideo();

                if (currentVideo) {
                    currentVideo.addEventListener('ended', async () => {
                        addMessage("视频播放结束，准备切换!");
                        await Next(title);
                    });
                }
            }

            let checkButton = GetCheckButton();
            if (checkButton != null) {
                addMessage("找到检测按钮，自动点击!");
                checkButton.click();
                await Wait(500);
            }
        }
    }

    // 确保在页面加载完成后执行
    if (document.readyState === 'complete') {
        Loading();
    } else {
        window.addEventListener('load', Loading);
    }
})();