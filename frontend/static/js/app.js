// frontend/static/js/app.js - 完整修复版

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
        
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.loadHistory();
        console.log('[初始化] 应用已启动');
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
        if (this.imageUploadArea) {
            this.imageUploadArea.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-btn')) this.imageInput.click();
            });
            this.imageUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
            this.imageUploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); });
            this.imageUploadArea.addEventListener('drop', (e) => this.handleImageDrop(e));
        }
        if (this.imageInput) this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        if (this.removeImageBtn) this.removeImageBtn.addEventListener('click', (e) => this.removeImage(e));
        
        if (this.videoUploadArea) {
            this.videoUploadArea.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-btn')) this.videoInput.click();
            });
            this.videoUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
            this.videoUploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); });
            this.videoUploadArea.addEventListener('drop', (e) => this.handleVideoDrop(e));
        }
        if (this.videoInput) this.videoInput.addEventListener('change', (e) => this.handleVideoSelect(e));
        if (this.removeVideoBtn) this.removeVideoBtn.addEventListener('click', (e) => this.removeVideo(e));
        
        if (this.confirmImageUrlBtn) this.confirmImageUrlBtn.addEventListener('click', () => this.useImageUrl());
        if (this.confirmVideoUrlBtn) this.confirmVideoUrlBtn.addEventListener('click', () => this.useVideoUrl());
        if (this.generateBtn) this.generateBtn.addEventListener('click', () => this.generateVideo());
        if (this.downloadBtn) this.downloadBtn.addEventListener('click', () => this.downloadVideo());
        if (this.regenerateBtn) this.regenerateBtn.addEventListener('click', () => this.regenerate());
        if (this.retryBtn) this.retryBtn.addEventListener('click', () => this.regenerate());
        if (this.refreshHistoryBtn) this.refreshHistoryBtn.addEventListener('click', () => this.loadHistory());
    }
    
    showState(state) {
        ['emptyState', 'generatingState', 'resultState', 'errorState'].forEach(s => {
            if (this[s]) this[s].style.display = 'none';
        });
        const el = this[state + 'State'];
        if (el) el.style.display = 'flex';
    }
    
    showToast(msg, type = 'info') {
        console.log(`[Toast] ${type}: ${msg}`);
        if (!this.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i><span>${msg}</span>`;
        this.toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, 3000);
    }
    
    handleImageSelect(e) { if (e.target.files[0]) this.processImage(e.target.files[0]); }
    handleImageDrop(e) {
        e.preventDefault(); e.currentTarget.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) this.processImage(file);
    }
    
    async processImage(file) {
        if (file.size > 5 * 1024 * 1024) { this.showToast('图片不能超过5MB', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.previewImage) this.previewImage.src = e.target.result;
            if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'none';
            if (this.imagePreview) this.imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        await this.uploadImage(file);
        this.updateGenerateButton();
    }
    
    async uploadImage(file) {
        const fd = new FormData(); fd.append('image', file);
        try {
            const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) { this.imageUrl = data.url; this.showToast('图片上传成功', 'success'); }
            else throw new Error(data.error);
        } catch (e) { this.showToast('上传失败', 'error'); this.removeImage(); }
    }
    
    removeImage(e) {
        if (e) e.stopPropagation();
        this.imageUrl = null;
        if (this.imageInput) this.imageInput.value = '';
        if (this.previewImage) this.previewImage.src = '';
        if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'flex';
        if (this.imagePreview) this.imagePreview.style.display = 'none';
        this.updateGenerateButton();
    }
    
    handleVideoSelect(e) { if (e.target.files[0]) this.processVideo(e.target.files[0]); }
    handleVideoDrop(e) {
        e.preventDefault(); e.currentTarget.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) this.processVideo(file);
    }
    
    async processVideo(file) {
        if (file.size > 200 * 1024 * 1024) { this.showToast('视频不能超过200MB', 'error'); return; }
        if (this.previewVideo) this.previewVideo.src = URL.createObjectURL(file);
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'none';
        if (this.videoPreview) this.videoPreview.style.display = 'block';
        await this.uploadVideo(file);
        this.updateGenerateButton();
    }
    
    async uploadVideo(file) {
        const fd = new FormData(); fd.append('video', file);
        try {
            const res = await fetch('/api/upload/video', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) { this.videoUrl = data.url; this.showToast('视频上传成功', 'success'); }
            else throw new Error(data.error);
        } catch (e) { this.showToast('上传失败', 'error'); this.removeVideo(); }
    }
    
    removeVideo(e) {
        if (e) e.stopPropagation();
        this.videoUrl = null;
        if (this.videoInput) this.videoInput.value = '';
        if (this.previewVideo) this.previewVideo.src = '';
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'flex';
        if (this.videoPreview) this.videoPreview.style.display = 'none';
        this.updateGenerateButton();
    }
    
    useImageUrl() {
        const url = this.imageUrlInput?.value.trim();
        if (!url?.startsWith('http')) { this.showToast('请输入有效URL', 'error'); return; }
        this.imageUrl = url;
        if (this.previewImage) this.previewImage.src = url;
        if (this.imagePlaceholder) this.imagePlaceholder.style.display = 'none';
        if (this.imagePreview) this.imagePreview.style.display = 'block';
        this.showToast('图片URL已设置', 'success');
        this.updateGenerateButton();
    }
    
    useVideoUrl() {
        const url = this.videoUrlInput?.value.trim();
        if (!url?.startsWith('http')) { this.showToast('请输入有效URL', 'error'); return; }
        this.videoUrl = url;
        if (this.previewVideo) this.previewVideo.src = url;
        if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'none';
        if (this.videoPreview) this.videoPreview.style.display = 'block';
        this.showToast('视频URL已设置', 'success');
        this.updateGenerateButton();
    }
    
    updateGenerateButton() {
        if (this.generateBtn) this.generateBtn.disabled = !(this.imageUrl && this.videoUrl);
    }
    
    async generateVideo() {
        if (!this.imageUrl || !this.videoUrl) { this.showToast('请先设置图片和视频', 'warning'); return; }
        
        const mode = document.querySelector('input[name="mode"]:checked')?.value || 'wan-std';
        
        try {
            this.showState('generating');
            if (this.generateBtn) { this.generateBtn.disabled = true; this.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...'; }
            if (this.statusText) this.statusText.textContent = '创建任务中...';
            
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: this.imageUrl, video_url: this.videoUrl, mode })
            });
            const data = await res.json();
            console.log('[生成] 响应:', data);
            
            if (data.success) {
                this.currentTaskId = data.task_id;
                if (this.taskIdDisplay) this.taskIdDisplay.textContent = `任务ID: ${data.task_id}`;
                this.showToast('任务创建成功', 'success');
                this.startPolling();
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            this.showToast('生成失败: ' + e.message, 'error');
            this.showState('error');
            if (this.errorMessage) this.errorMessage.textContent = e.message;
            if (this.generateBtn) { this.generateBtn.disabled = false; this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成视频'; }
        }
    }
    
    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => this.checkTaskStatus(), 8000);
        setTimeout(() => this.checkTaskStatus(), 1000);
    }
    
    stopPolling() {
        if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    }
    
    async checkTaskStatus() {
        if (!this.currentTaskId) return;
        
        try {
            const res = await fetch(`/api/task/${this.currentTaskId}`);
            const data = await res.json();
            console.log('[轮询] 任务状态:', data);
            
            if (!data.success) return;
            
            const status = data.task_status;
            if (this.statusText) {
                this.statusText.textContent = { PENDING: '排队中...', RUNNING: '生成中(约2-5分钟)...', SUCCEEDED: '完成!', FAILED: '失败' }[status] || status;
            }
            
            if (status === 'SUCCEEDED') {
                this.stopPolling();
                console.log('[轮询] 成功! video_url:', data.video_url);
                
                // 保存原始URL
                this.originalVideoUrl = data.video_url;
                
                if (data.video_url) {
                    await this.saveAndPlayVideo(data.video_url);
                } else {
                    this.showToast('视频URL为空', 'error');
                }
                
                this.showState('result');
                if (this.generateBtn) { this.generateBtn.disabled = false; this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成视频'; }
                if (this.videoDuration) this.videoDuration.textContent = data.video_duration ? `${parseFloat(data.video_duration).toFixed(2)}秒` : '-';
                if (this.videoRatio) this.videoRatio.textContent = data.video_ratio || '-';
                this.loadHistory();
                
            } else if (status === 'FAILED') {
                this.stopPolling();
                this.showState('error');
                if (this.errorMessage) this.errorMessage.textContent = data.message || '生成失败';
                if (this.generateBtn) { this.generateBtn.disabled = false; this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成视频'; }
            }
        } catch (e) {
            console.error('[轮询] 错误:', e);
        }
    }
    
    async saveAndPlayVideo(videoUrl) {
        console.log('[保存] 开始保存视频:', videoUrl);
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
                this.showToast('视频已就绪!', 'success');
            } else {
                throw new Error(data.error || '保存失败');
            }
        } catch (e) {
            console.error('[保存] 失败:', e);
            this.showToast('获取视频失败，但您可以尝试下载', 'warning');
        }
    }
    
    async downloadVideo() {
        console.log('[下载] 开始下载');
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
                if (data.success) {
                    url = data.url;
                    this.localVideoUrl = url;
                }
            } catch (e) {
                console.error('[下载] 保存失败:', e);
            }
        }
        // 继续 downloadVideo 方法
        if (!url) {
            this.showToast('没有可下载的视频', 'warning');
            return;
        }
        
        console.log('[下载] 最终URL:', url);
        
        // 执行下载
        const a = document.createElement('a');
        a.href = url;
        a.download = `wan_video_${Date.now()}.mp4`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast('开始下载', 'success');
    }
    
    regenerate() {
        this.showState('empty');
        this.currentTaskId = null;
        this.localVideoUrl = null;
        this.originalVideoUrl = null;
        this.stopPolling();
        if (this.generateBtn) {
            this.generateBtn.disabled = !(this.imageUrl && this.videoUrl);
            this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成视频';
        }
        if (this.resultVideo) this.resultVideo.src = '';
    }
    
    async loadHistory() {
        try {
            if (this.refreshHistoryBtn) this.refreshHistoryBtn.classList.add('spinning');
            const res = await fetch('/api/tasks');
            const data = await res.json();
            
            if (data.success && data.tasks?.length > 0) {
                this.renderHistory(data.tasks);
            } else {
                if (this.historyList) this.historyList.innerHTML = '<div class="history-empty"><p>暂无历史记录</p></div>';
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
        const statusMap = { pending: '排队中', running: '生成中', succeeded: '已完成', failed: '失败', unknown: '未知' };
        
        this.historyList.innerHTML = sorted.map(t => {
            const st = (t.status || 'unknown').toLowerCase();
            const videoUrl = t.result?.video_url || '';
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
