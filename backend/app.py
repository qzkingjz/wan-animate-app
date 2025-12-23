# backend/app.py - 集成阿里云OSS完整版

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import requests
import os
import uuid
from datetime import datetime
import json
from werkzeug.utils import secure_filename
import oss2
from urllib.parse import quote

# 获取路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

app = Flask(__name__, 
            template_folder=os.path.join(ROOT_DIR, 'frontend/templates'),
            static_folder=os.path.join(ROOT_DIR, 'frontend/static'))
CORS(app)

# 本地存储配置
UPLOAD_FOLDER = os.path.join(ROOT_DIR, 'uploads')
DOWNLOAD_FOLDER = os.path.join(ROOT_DIR, 'downloads')
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'bmp', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 200 * 1024 * 1024

# 阿里云 API 配置
DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

# 阿里云 OSS 配置
OSS_ACCESS_KEY_ID = os.environ.get('OSS_ACCESS_KEY_ID', '')
OSS_ACCESS_KEY_SECRET = os.environ.get('OSS_ACCESS_KEY_SECRET', '')
OSS_BUCKET_NAME = os.environ.get('OSS_BUCKET_NAME', '')
OSS_ENDPOINT = os.environ.get('OSS_ENDPOINT', 'oss-cn-shanghai.aliyuncs.com')
OSS_REGION = os.environ.get('OSS_REGION', 'cn-shanghai')

# 创建目录
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# 任务存储
tasks = {}

# OSS 客户端
oss_bucket = None

def init_oss():
    """初始化 OSS 客户端"""
    global oss_bucket
    if OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET and OSS_BUCKET_NAME:
        try:
            auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
            oss_bucket = oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)
            # 测试连接
            oss_bucket.get_bucket_info()
            print(f"[OSS] 连接成功: {OSS_BUCKET_NAME}")
            return True
        except Exception as e:
            print(f"[OSS] 连接失败: {e}")
            oss_bucket = None
            return False
    else:
        print("[OSS] 未配置 OSS，将使用本地存储（功能受限）")
        return False

def upload_to_oss(local_file_path, object_name, content_type=None):
    """上传文件到 OSS 并返回公网 URL"""
    if not oss_bucket:
        return None
    
    try:
        # 设置 Content-Type
        headers = {}
        if content_type:
            headers['Content-Type'] = content_type
        
        # 上传文件
        with open(local_file_path, 'rb') as f:
            oss_bucket.put_object(object_name, f, headers=headers)
        
        # 生成公网 URL（永久有效，需要 Bucket 设置为公共读或使用签名 URL）
        # 方法1：如果 Bucket 是公共读
        # url = f"https://{OSS_BUCKET_NAME}.{OSS_ENDPOINT}/{object_name}"
        
        # 方法2：生成签名 URL（有效期 1 小时）
        url = oss_bucket.sign_url('GET', object_name, 3600)
        
        print(f"[OSS] 上传成功: {object_name}")
        print(f"[OSS] URL: {url[:100]}...")
        
        return url
    except Exception as e:
        print(f"[OSS] 上传失败: {e}")
        return None

def delete_from_oss(object_name):
    """从 OSS 删除文件"""
    if not oss_bucket:
        return False
    try:
        oss_bucket.delete_object(object_name)
        return True
    except Exception as e:
        print(f"[OSS] 删除失败: {e}")
        return False

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_content_type(filename):
    """根据文件名获取 Content-Type"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime'
    }
    return content_types.get(ext, 'application/octet-stream')

# ==================== 路由 ====================

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
    """上传图片 - 自动上传到 OSS"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': '没有上传图片'})
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'})
    
    if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({'success': False, 'error': '不支持的图片格式，请上传 JPG/PNG/BMP/WEBP'})
    
    # 检查文件大小
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_IMAGE_SIZE:
        return jsonify({'success': False, 'error': '图片大小不能超过 5MB'})
    
    # 生成文件名
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    local_path = os.path.join(UPLOAD_FOLDER, filename)
    
    # 保存到本地
    file.save(local_path)
    
    # 上传到 OSS
    if oss_bucket:
        oss_object_name = f"wan-animate/images/{filename}"
        content_type = get_content_type(filename)
        oss_url = upload_to_oss(local_path, oss_object_name, content_type)
        
        if oss_url:
            return jsonify({
                'success': True,
                'filename': filename,
                'url': oss_url,  # 返回 OSS URL
                'local_url': f"/uploads/{filename}",
                'size': file_size,
                'storage': 'oss'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'OSS 上传失败，请检查 OSS 配置'
            })
    else:
        # OSS 未配置，返回提示
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f"/uploads/{filename}",
            'size': file_size,
            'storage': 'local',
            'warning': 'OSS 未配置，请手动输入公网可访问的图片 URL'
        })

@app.route('/api/upload/video', methods=['POST'])
def upload_video():
    """上传视频 - 自动上传到 OSS"""
    if 'video' not in request.files:
        return jsonify({'success': False, 'error': '没有上传视频'})
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'})
    
    if not allowed_file(file.filename, ALLOWED_VIDEO_EXTENSIONS):
        return jsonify({'success': False, 'error': '不支持的视频格式，请上传 MP4/AVI/MOV'})
    
    # 检查文件大小
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_VIDEO_SIZE:
        return jsonify({'success': False, 'error': '视频大小不能超过 200MB'})
    
    # 生成文件名
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    local_path = os.path.join(UPLOAD_FOLDER, filename)
    
    # 保存到本地
    file.save(local_path)
    
    # 上传到 OSS
    if oss_bucket:
        oss_object_name = f"wan-animate/videos/{filename}"
        content_type = get_content_type(filename)
        oss_url = upload_to_oss(local_path, oss_object_name, content_type)
        
        if oss_url:
            return jsonify({
                'success': True,
                'filename': filename,
                'url': oss_url,  # 返回 OSS URL
                'local_url': f"/uploads/{filename}",
                'size': file_size,
                'storage': 'oss'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'OSS 上传失败，请检查 OSS 配置'
            })
    else:
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f"/uploads/{filename}",
            'size': file_size,
            'storage': 'local',
            'warning': 'OSS 未配置，请手动输入公网可访问的视频 URL'
        })

@app.route('/api/generate', methods=['POST'])
def generate_video():
    """创建视频生成任务"""
    data = request.json
    image_url = data.get('image_url')
    video_url = data.get('video_url')
    mode = data.get('mode', 'wan-std')
    check_image = data.get('check_image', True)
    
    if not image_url or not video_url:
        return jsonify({'success': False, 'error': '请提供图片URL和视频URL'})
    
    # 检查 URL 是否是公网可访问的
    if image_url.startswith('/uploads/') or video_url.startswith('/uploads/'):
        return jsonify({
            'success': False, 
            'error': 'URL 必须是公网可访问的地址（以 http:// 或 https:// 开头）。请配置 OSS 或手动输入公网 URL。'
        })
    
    print(f"[生成] 图片: {image_url[:80]}...")
    print(f"[生成] 视频: {video_url[:80]}...")
    print(f"[生成] 模式: {mode}")
    
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
        print(f"[生成] 响应: {result}")
        
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
            error_msg = result.get('message', '创建任务失败')
            return jsonify({'success': False, 'error': error_msg})
    except Exception as e:
        print(f"[生成] 异常: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """查询任务状态"""
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
        print(f"[查询] 异常: {e}")
        return jsonify({'success': False, 'error': str(e), 'task_status': 'UNKNOWN'})

@app.route('/api/save-video', methods=['POST'])
def save_video():
    """保存生成的视频到本地"""
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

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取配置状态"""
    return jsonify({
        'api_key_configured': bool(DASHSCOPE_API_KEY),
        'oss_configured': oss_bucket is not None,
        'oss_bucket': OSS_BUCKET_NAME if oss_bucket else None,
        'oss_endpoint': OSS_ENDPOINT if oss_bucket else None
    })

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'api_key': bool(DASHSCOPE_API_KEY),
        'oss': oss_bucket is not None
    })

# ==================== 启动 ====================

if __name__ == '__main__':
    print("=" * 50)
    print("    图生动作 - AI视频生成应用")
    print("=" * 50)
    print(f"API Key: {'✓ 已配置' if DASHSCOPE_API_KEY else '✗ 未配置'}")
    
    # 初始化 OSS
    oss_ok = init_oss()
    print(f"OSS: {'✓ 已连接' if oss_ok else '✗ 未配置或连接失败'}")
    
    if not oss_ok:
        print("")
        print("提示: OSS 未配置，上传功能将受限")
        print("请设置以下环境变量:")
        print("  - OSS_ACCESS_KEY_ID")
        print("  - OSS_ACCESS_KEY_SECRET")
        print("  - OSS_BUCKET_NAME")
        print("  - OSS_ENDPOINT (可选，默认 oss-cn-shanghai.aliyuncs.com)")
    
    print("")
    print(f"服务地址: http://0.0.0.0:5000")
    print("=" * 50)
    
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
