# backend/app.py - 生产环境版本

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import requests
import os
import uuid
from datetime import datetime
import json
from werkzeug.utils import secure_filename

# 获取路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

app = Flask(__name__, 
            template_folder=os.path.join(ROOT_DIR, 'frontend/templates'),
            static_folder=os.path.join(ROOT_DIR, 'frontend/static'))
CORS(app)

# 配置
UPLOAD_FOLDER = os.path.join(ROOT_DIR, 'uploads')
DOWNLOAD_FOLDER = os.path.join(ROOT_DIR, 'downloads')
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'bmp', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 200 * 1024 * 1024

DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

tasks = {}

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/downloads/<filename>')
def download_file(filename):
    filepath = os.path.join(DOWNLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        return send_from_directory(DOWNLOAD_FOLDER, filename, as_attachment=True)
    return jsonify({'error': '文件不存在'}), 404

@app.route('/api/upload/image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({'error': '不支持的图片格式'}), 400
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > MAX_IMAGE_SIZE:
        return jsonify({'error': '图片不能超过5MB'}), 400
    filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({'success': True, 'filename': filename, 'url': f"/uploads/{filename}", 'size': file_size})

@app.route('/api/upload/video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': '没有上传视频'}), 400
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    if not allowed_file(file.filename, ALLOWED_VIDEO_EXTENSIONS):
        return jsonify({'error': '不支持的视频格式'}), 400
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > MAX_VIDEO_SIZE:
        return jsonify({'error': '视频不能超过200MB'}), 400
    filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({'success': True, 'filename': filename, 'url': f"/uploads/{filename}", 'size': file_size})

@app.route('/api/generate', methods=['POST'])
def generate_video():
    data = request.json
    image_url = data.get('image_url')
    video_url = data.get('video_url')
    mode = data.get('mode', 'wan-std')
    check_image = data.get('check_image', True)
    
    if not image_url or not video_url:
        return jsonify({'success': False, 'error': '请提供图片URL和视频URL'})
    
    headers = {
        'Authorization': f'Bearer {DASHSCOPE_API_KEY}',
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
    }
    payload = {
        'model': 'wan2.2-animate-move',
        'input': {'image_url': image_url, 'video_url': video_url},
        'parameters': {'mode': mode, 'check_image': check_image}
    }
    
    try:
        response = requests.post(
            f'{API_BASE_URL}/services/aigc/image2video/video-synthesis',
            headers=headers, json=payload, timeout=30
        )
        result = response.json()
        
        if response.status_code == 200 and result.get('output', {}).get('task_id'):
            task_id = result['output']['task_id']
            task_status = result['output'].get('task_status', 'PENDING')
            tasks[task_id] = {
                'task_id': task_id,
                'status': task_status,
                'mode': mode,
                'created_at': datetime.now().isoformat(),
                'result': None
            }
            return jsonify({'success': True, 'task_id': task_id, 'task_status': task_status})
        else:
            return jsonify({'success': False, 'error': result.get('message', '创建任务失败')})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    headers = {'Authorization': f'Bearer {DASHSCOPE_API_KEY}'}
    
    try:
        response = requests.get(f'{API_BASE_URL}/tasks/{task_id}', headers=headers, timeout=60)
        result = response.json()
        
        output = result.get('output', {})
        usage = result.get('usage', {})
        task_status = output.get('task_status', 'UNKNOWN')
        
        video_url = None
        if task_status == 'SUCCEEDED':
            results_data = output.get('results')
            if results_data:
                if isinstance(results_data, list) and len(results_data) > 0:
                    first_result = results_data[0]
                    if isinstance(first_result, dict):
                        video_url = first_result.get('video_url')
                    elif isinstance(first_result, str):
                        video_url = first_result
                elif isinstance(results_data, dict):
                    video_url = results_data.get('video_url')
            if not video_url:
                video_url = output.get('video_url')
        
        if task_id in tasks:
            tasks[task_id]['status'] = task_status
            if video_url:
                tasks[task_id]['result'] = {'video_url': video_url}
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'task_status': task_status,
            'video_url': video_url,
            'video_duration': usage.get('video_duration'),
            'video_ratio': usage.get('video_ratio'),
            'message': output.get('message'),
            'code': output.get('code')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'task_status': 'UNKNOWN'})

@app.route('/api/save-video', methods=['POST'])
def save_video():
    data = request.json
    video_url = data.get('video_url')
    
    if not video_url:
        return jsonify({'success': False, 'error': '缺少视频URL'})
    
    try:
        response = requests.get(video_url, stream=True, timeout=120)
        
        if response.status_code == 200:
            filename = f"result_{uuid.uuid4().hex[:8]}.mp4"
            filepath = os.path.join(DOWNLOAD_FOLDER, filename)
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            file_size = os.path.getsize(filepath)
            return jsonify({
                'success': True,
                'filename': filename,
                'url': f'/downloads/{filename}',
                'size': file_size
            })
        else:
            return jsonify({'success': False, 'error': f'下载失败: {response.status_code}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/tasks', methods=['GET'])
def get_all_tasks():
    return jsonify({'success': True, 'tasks': list(tasks.values())})

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'api_key_configured': bool(DASHSCOPE_API_KEY)})

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    print(f"API Key: {'已配置' if DASHSCOPE_API_KEY else '未配置'}")
    print(f"运行模式: {'开发' if debug_mode else '生产'}")
    print(f"服务地址: http://0.0.0.0:5000")
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
