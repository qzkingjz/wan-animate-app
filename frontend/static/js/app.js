// frontend/static/js/app.js - 完整版（含OSS支持）

class WanAnimateApp {
    constructor() {
        this.imageFile = null;
        this.videoFile = null;
        this.imageUrl = null;
        this.videoUrl = null;
        this.currentTaskId = null;
        this.pollingInterval = null;
        this.localVideoUrl = null;
        this.originalVideoUrl = null;
        this.ossConfigured = false;
        
        this.init();
    }
    
    async init() {
        this.bindElements();
        this.bindEvents();
        this.loadHistory();
        await this.checkConfig();
        console.log('[初始化] 应用已启动');
    }
    
    async checkConfig() {
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            this.ossConfigured = config.oss_configured;
            
            if (!config.api_key_configured) {
                this.showToast('警告: API Key 未配置', 'warning');
            }
            if (!config.oss_configured) {
                console.log('[配置] OSS 未配置，需要手动输入URL');
            } else {
                console.log('[配置] OSS 已配置:', config.oss_bucket);
                this.showToast('OSS 已连接，可直接上传文件', 'success');
            }
        } catch (e) {
            console.error('[配置] 检查失败:', e);
        }
    }
    
    bindElements() {
        this.imageUploadArea = document.getElementById('imageUploadArea');
        this.videoUploadArea = document.getElementById('videoUploadArea');
        this.imageInput = document.getElementById('imageInput');
        this.videoInput = document.getElementById('videoInput');
        this.imagePlaceholder = document.getElementById('imagePlaceholder');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        this.imagePreview = document.getElementById('imagePreview');
        this.videoPreview = document.getElementById('videoPreview');
        this.previewImage = document.getElementById('previewImage');
        this.previewVideo = document.getElementById('previewVideo');
        this.removeImageBtn = document.getElementById('removeImage');
        this.removeVideoBtn = document.getElementById('removeVideo');
        this.imageUrlInput = document.getElementById('imageUrlInput');
        this.videoUrlInput = document.getElementById('videoUrlInput');
        this.confirmImageUrlBtn = document.getElementById('confirmImageUrl');
        this.confirmVideoUrlBtn = document.getElementById('confirmVideoUrl');
        this.checkImageInput = document.getElementById('checkImage');
        this.generateBtn = document.getElementById('generateBtn');
        this.emptyState = document.getElementById('emptyState');
        this.generatingState = document.getElementById('generatingState');
        this.resultState = document.getElementById('resultState');
        this.errorState = document.getElementById('errorState');
        this.statusText = document.getElementById('statusText');
        this.taskIdDisplay = document.getElementById('taskIdDisplay');
        this.errorMessage = document.getElementById('errorMessage');
        this.resultVideo = document.getElementById('resultVideo');
        this.videoDuration = document.getElementById('videoDuration');
        this.videoRatio = document.getElementById('videoRatio');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.regenerateBtn = document.getElementById('regenerateBtn');
        this.retryBtn = document.getElementById('retryBtn');
        this.historyList = document.getElementById('historyList');
        this.refreshHistoryBtn = document.getElementById('refreshHistory');
        this.toastContainer = document.getElementById('toastContainer');
    }
    
    bindEvents() {
        // 图片上传区域点击
        if (this.imageUploadArea) {
            this.imageUploadArea.addEventListener('click', (e) => {
                // 排除删除按钮的点击
                if (e.target.closest('.remove-btn')) return;
                if (this.imageInput) {
                    this.imageInput.click();
                }
            });
            this.imageUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.imageUploadArea.classList.add('dragover');
            });
            this.imageUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.imageUploadArea.classList.remove('dragover');
            });
            this.imageUploadArea.addEventListener('drop', (e) => this.handleImageDrop(e));
        }
        
        // 图片input变化
        if (this.imageInput) {
            this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        
        // 删除图片按钮
        if (this.removeImageBtn) {
            this.removeImageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeImage();
            });
        }
        
        // 视频上传区域点击
        if (this.videoUploadArea) {
            this.videoUploadArea.addEventListener('click', (e) => {
                if (e.target.closest('.remove-btn')) return;
                if (this.videoInput) {
                    this.videoInput.click();
                }
            });
            this.videoUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.videoUploadArea.classList.add('dragover');
            });
            this.videoUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.videoUploadArea.classList.remove('dragover');
            });
            this.videoUploadArea.addEventListener('drop', (e) => this.handleVideoDrop(e));
        }
        
        // 视频input变化
        if (this.videoInput) {
            this.videoInput.addEventListener('change', (e) => this.handleVideoSelect(e));
        }
        
        // 删除视频按钮
        if (this.removeVideoBtn) {
            this.removeVideoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeVideo();
            });
        }
        
        // URL输入确认
        if (this.confirmImageUrlBtn) {
            this.confirmImageUrlBtn.addEventListener('click', () => this.useImageUrl());
        }
        if (this.confirmVideoUrlBtn) {
            this.confirmVideoUrlBtn.addEventListener('click', () => this.useVideoUrl());
        }
        
        // 生成按钮
        if (this.generateBtn) {
            this.generateBtn.addEventListener('click', () => this.generateVideo());
        }
        
        // 下载按钮
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadVideo());
        }
        
        // 重新生成按钮
        if (this.regenerateBtn) {
            this.regenerateBtn.addEventListener('click', () => this.regenerate());
        }
        
        // 重试按钮
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.regenerate());
        }
        
        // 刷新历史记录
        if (this.refreshHistoryBtn) {
            this.refreshHistoryBtn.addEventListener('click', () => this.loadHistory());
        }
    }
    
    showState(state) {
        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.generatingState) this.generatingState.style.display = 'none';
        if (this.resultState) this.resultState.style.display = 'none';
        if (this.errorState) this.errorState.style.display = 'none';
        
        const stateEl = {
            'empty': this.emptyState,
            'generating': this.generatingState,
            'result': this.resultState,
            'error': this.errorState
        }[state];
        
        if (stateEl) stateEl.style.display = 'flex';
    }
    
    showToast(msg, type = 'info') {
        console.log(`[Toast] ${type}: ${msg}`);
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconMap = {
            'success': 'fa-check-circle',
            'error': 'fa-times-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${msg}</span>`;
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // ========== 图片处理 ==========
    
    handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            console.log('[图片] 选择文件:', file.name);
            this.processImage(file);
        }
    }
    
    handleImageDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.imageUploadArea.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            console.log('[图片] 拖放文件:', file.name);
            this.processImage(file);
        } else {
            this.showToast('请上传图片文件', 'error');
        }
    }
    
    async processImage(file) {
        // 验证大小
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('图片大小不能超过 5MB', 'error');
            return;
        }
        
        // 验证格式
        const validTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showToast('请上传 JPG/PNG/BMP/WEBP 格式图片', 'error');
            return;
        }
        
        this.imageFile = file;
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.previewImage) this.previewImage.src = e.target.result;
            if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'none';
            if (this.imagePreview) this.imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // 上传
        await this.uploadImage(file);
        this.updateGenerateButton();
    }
    
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            this.showToast('上传图片中...', 'info');
            
            const res = await fetch('/api/upload/image', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            console.log('[图片] 上传结果:', data);
            
            if (data.success) {
                this.imageUrl = data.url;
                
                if (data.storage === 'oss') {
                    this.showToast('图片已上传到云存储', 'success');
                } else if (data.warning) {
                    this.showToast(data.warning, 'warning');
                } else {
                    this.showToast('图片上传成功', 'success');
                }
            } else {
                throw new Error(data.error || '上传失败');
            }
        } catch (e) {
            console.error('[图片] 上传失败:', e);
            this.showToast('上传失败: ' + e.message, 'error');
            this.removeImage();
        }
    }
    
    removeImage() {
        this.imageFile = null;
        this.imageUrl = null;
        if (this.imageInput) this.imageInput.value = '';
        if (this.previewImage) this.previewImage.src = '';
        if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'flex';
        if (this.imagePreview) this.imagePreview.style.display = 'none';
        if (this.imageUrlInput) this.imageUrlInput.value = '';
        this.updateGenerateButton();
    }
    
    // ========== 视频处理 ==========
    
    handleVideoSelect(e) {
        const file = e.target.files[0];
        if (file) {
            console.log('[视频] 选择文件:', file.name);
            this.processVideo(file);
        }
    }
    
    handleVideoDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.videoUploadArea.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            console.log('[视频] 拖放文件:', file.name);
            this.processVideo(file);
        } else {
            this.showToast('请上传视频文件', 'error');
        }
    }
    
    async processVideo(file) {
        // 验证大小
        if (file.size > 200 * 1024 * 1024) {
            this.showToast('视频大小不能超过 200MB', 'error');
            return;
        }
        
        // 验证格式
        const validTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
        if (!validTypes.includes(file.type)) {
            this.showToast('请上传 MP4/AVI/MOV 格式视频', 'error');
            return;
        }
        
        this.videoFile = file;
        
        // 显示预览
        if (this.previewVideo) this.previewVideo.src = URL.createObjectURL(file);
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'none';
        if (this.videoPreview) this.videoPreview.style.display = 'block';
        
        // 上传
        await this.uploadVideo(file);
        this.updateGenerateButton();
    }
    
    async uploadVideo(file) {
        const formData = new FormData();
        formData.append('video', file);
        
        try {
            this.showToast('上传视频中（可能需要一些时间）...', 'info');
            
            const res = await fetch('/api/upload/video', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            console.log('[视频] 上传结果:', data);
            
            if (data.success) {
                this.videoUrl = data.url;
                
                if (data.storage === 'oss') {
                    this.showToast('视频已上传到云存储', 'success');
                } else if (data.warning) {
                    this.showToast(data.warning, 'warning');
                } else {
                    this.showToast('视频上传成功', 'success');
                }
            } else {
                throw new Error(data.error || '上传失败');
            }
        } catch (e) {
            console.error('[视频] 上传失败:', e);
            this.showToast('上传失败: ' + e.message, 'error');
            this.removeVideo();
        }
    }
    
    removeVideo() {
        this.videoFile = null;
        this.videoUrl = null;
        if (this.videoInput) this.videoInput.value = '';
        if (this.previewVideo) this.previewVideo.src = '';
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'flex';
        if (this.videoPreview) this.videoPreview.style.display = 'none';
        if (this.videoUrlInput) this.videoUrlInput.value = '';
        this.updateGenerateButton();
    }
    
    // ========== URL 输入 ==========
    
    useImageUrl() {
        const url = this.imageUrlInput ? this.imageUrlInput.value.trim() : '';
        if (!url) {
            this.showToast('请输入图片URL', 'warning');
            return;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            this.showToast('请输入有效的URL（以 http:// 或 https:// 开头）', 'error');
            return;
        }
        
        this.imageUrl = url;
        if (this.previewImage) this.previewImage.src = url;
        if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'none';
        if (this.imagePreview) this.imagePreview.style.display = 'block';
        this.showToast('图片URL已设置', 'success');
        this.updateGenerateButton();
    }
    
    useVideoUrl() {
        const url = this.videoUrlInput ? this.videoUrlInput.value.trim() : '';
        if (!url) {
            this.showToast('请输入视频URL', 'warning');
            return;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            this.showToast('请输入有效的URL（以 http:// 或 https:// 开头）', 'error');
            return;
        }
        
        this.videoUrl = url;
        if (this.previewVideo) this.previewVideo.src = url;
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'none';
        if (this.videoPreview) this.videoPreview.style.display = 'block';
        this.showToast('视频URL已设置', 'success');
        this.updateGenerateButton();
    }
    
    // ========== 生成视频 ==========
    
    updateGenerateButton() {
        if (this.generateBtn) {
            this.generateBtn.disabled = !(this.imageUrl && this.videoUrl);
        }
    }
    
    async generateVideo() {
        if (!this.imageUrl || !this.videoUrl) {
            this.showToast('请先设置图片和视频', 'warning');
            return;
        }
        
        // 检查URL是否是公网可访问的
        if (this.imageUrl.startsWith('/') || this.videoUrl.startsWith('/')) {
            this.showToast('请使用公网可访问的URL（需要配置OSS或手动输入URL）', 'error');
            return;
        }
        
        const modeEl = document.querySelector('input[name="mode"]:checked');
        const mode = modeEl ? modeEl.value : 'wan-std';
        const checkImage = this.checkImageInput ? this.checkImageInput.checked : true;
        
        console.log('[生成] 开始生成', { imageUrl: this.imageUrl, videoUrl: this.videoUrl, mode });
        
        try {
            this.showState('generating');
            if (this.generateBtn) {
                this.generateBtn.disabled = true;
                this.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
            }
            if (this.statusText) this.statusText.textContent = '创建任务中...';
            
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: this.imageUrl,
                    video_url: this.videoUrl,
                    mode: mode,
                    check_image: checkImage
                })
            });
            
            const data = await res.json();
            console.log('[生成] 响应:', data);
            
            if (data.success) {
                this.currentTaskId = data.task_id;
                if (this.taskIdDisplay) this.taskIdDisplay.textContent = `任务ID: ${data.task_id}`;
                this.showToast('任务创建成功，开始生成...', 'success');
                this.startPolling();
            } else {
                throw new Error(data.error || '创建任务失败');
            }
        } catch (e) {
            console.error('[生成] 失败:', e);
            this.showToast('生成失败: ' + e.message, 'error');
            this.showState('error');
            if (this.errorMessage) this.errorMessage.textContent = e.message;
            this.resetGenerateButton();
        }
    }
    
    resetGenerateButton() {
        if (this.generateBtn) {
            this.generateBtn.disabled = !(this.imageUrl && this.videoUrl);
            this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成视频';
        }
    }
    
    // ========== 任务轮询 ==========
    
    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => this.checkTaskStatus(), 8000);
        setTimeout(() => this.checkTaskStatus(), 2000);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    async checkTaskStatus() {
        if (!this.currentTaskId) return;
        
        try {
            const res = await fetch(`/api/task/${this.currentTaskId}`);
            const data = await res.json();
            console.log('[轮询] 状态:', data);
            
            if (!data.success) return;
            
            const status = data.task_status;
            if (this.statusText) {
                const statusMap = {
                    'PENDING': '排队中，请耐心等待...',
                    'RUNNING': '生成中，预计需要2-5分钟...',
                    'SUCCEEDED': '生成完成！',
                    'FAILED': '生成失败'
                };
                this.statusText.textContent = statusMap[status] || status;
            }
            
            if (status === 'SUCCEEDED') {
                this.stopPolling();
                this.originalVideoUrl = data.video_url;
                console.log('[轮询] 成功，视频URL:', data.video_url);
                
                if (data.video_url) {
                    await this.saveAndPlayVideo(data.video_url);
                }
                
                this.showState('result');
                this.resetGenerateButton();
                
                if (this.videoDuration) {
                    this.videoDuration.textContent = data.video_duration ? `${parseFloat(data.video_duration).toFixed(2)}秒` : '-';
                }
                if (this.videoRatio) {
                    this.videoRatio.textContent = data.video_ratio || '-';
                }
                
                this.loadHistory();
                
            } else if (status === 'FAILED') {
                this.stopPolling();
                this.showState('error');
                if (this.errorMessage) this.errorMessage.textContent = data.message || '生成失败，请重试';
                this.resetGenerateButton();
                this.showToast('生成失败: ' + (data.message || '未知错误'), 'error');
            }
        } catch (e) {
            console.error('[轮询] 错误:', e);
        }
    }
    
    async saveAndPlayVideo(videoUrl) {
        console.log('[保存] 开始保存视频');
        this.showToast('正在获取视频...', 'info');
        
        try {
            const res = await fetch('/api/save-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_url: videoUrl })
            });
            const data = await res.json();
            console.log('[保存] 结果:', data);
            
            if (data.success && data.url) {
                this.localVideoUrl = data.url;
                if (this.resultVideo) {
                    this.resultVideo.src = data.url;
                    this.resultVideo.load();
                }
                this.showToast('视频已就绪！', 'success');
            } else {
                throw new Error(data.error || '保存失败');
            }
        } catch (e) {
            console.error('[保存] 失败:', e);
            this.showToast('视频保存失败，但您可以尝试下载', 'warning');
        }
    }
    
    // ========== 下载视频 ==========
    
    async downloadVideo() {
        console.log('[下载] 开始');
        console.log('[下载] localVideoUrl:', this.localVideoUrl);
        console.log('[下载] originalVideoUrl:', this.originalVideoUrl);
        
        let url = this.localVideoUrl;
        
        // 如果本地没有，尝试重新保存
        if (!url && this.originalVideoUrl) {
            this.showToast('正在准备下载...', 'info');
            try {
                const res = await fetch('/api/save-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_url: this.originalVideoUrl })
                });
                const data = await res.json();
                if (data.success && data.url) {
                    url = data.url;
                    this.localVideoUrl = url;
                }
            } catch (e) {
                console.error('[下载] 保存失败:', e);
            }
        }
        
        if (!url) {
            this.showToast('没有可下载的视频', 'warning');
            return;
        }
        
        console.log('[下载] 最终URL:', url);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wan_video_${Date.now()}.mp4`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast('开始下载', 'success');
    }
    
    // ========== 其他 ==========
    
    regenerate() {
        this.showState('empty');
        this.currentTaskId = null;
        this.localVideoUrl = null;
        this.originalVideoUrl = null;
        this.stopPolling();
        this.resetGenerateButton();
        if (this.resultVideo) this.resultVideo.src = '';
    }
    
    async loadHistory() {
        try {
            if (this.refreshHistoryBtn) this.refreshHistoryBtn.classList.add('spinning');
            
            const res = await fetch('/api/tasks');
            const data = await res.json();
            
            if (data.success && data.tasks && data.tasks.length > 0) {
                this.renderHistory(data.tasks);
            } else {
                if (this.historyList) {
                    this.historyList.innerHTML = '<div class="history-empty"><p>暂无历史记录</p></div>';
                }
            }
        } catch (e) {
            console.error('[历史] 加载失败:', e);
        } finally {
            if (this.refreshHistoryBtn) this.refreshHistoryBtn.classList.remove('spinning');
        }
    }
    
    renderHistory(tasks) {
        if (!this.historyList) return;
        
        const sorted = tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const statusMap = {
            'pending': '排队中',
            'running': '生成中',
            'succeeded': '已完成',
            'failed': '失败',
            'unknown': '未知'
        };
        
        this.historyList.innerHTML = sorted.map(t => {
            const st = (t.status || 'unknown').toLowerCase();
            const videoUrl = (t.result && t.result.video_url) ? t.result.video_url : '';
            return `
                <div class="history-item" data-task-id="${t.task_id}" data-video-url="${videoUrl}">
                    <div class="history-thumbnail"><i class="fas fa-video"></i></div>
                    <div class="history-info">
                        <div class="history-title">${t.mode === 'wan-pro' ? '专业模式' : '标准模式'}</div>
                        <div class="history-meta">${t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '-'}</div>
                    </div>
                    <span class="history-status ${st}">${statusMap[st] || t.status}</span>
                </div>
            `;
        }).join('');
        
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => this.handleHistoryClick(item));
        });
    }
    
    async handleHistoryClick(item) {
        const taskId = item.dataset.taskId;
        const videoUrl = item.dataset.videoUrl;
        
        console.log('[历史] 点击:', taskId, videoUrl);
        
        if (videoUrl) {
            this.originalVideoUrl = videoUrl;
            await this.saveAndPlayVideo(videoUrl);
            this.showState('result');
        } else {
            this.currentTaskId = taskId;
            this.showState('generating');
            if (this.taskIdDisplay) this.taskIdDisplay.textContent = `任务ID: ${taskId}`;
            this.checkTaskStatus();
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WanAnimateApp();
});
