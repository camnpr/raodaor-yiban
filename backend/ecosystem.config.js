/**
 * PM2 配置文件 - 针对 Windows Server 2012 R2 优化
 * 服务器配置：2核CPU、2GB内存、4Mbps带宽、40G系统盘+60G数据盘
 */

module.exports = {
  apps: [
    {
      name: 'raodaor-yiban-server',
      script: './dist/main.js',

      // 2核CPU：单实例 fork 模式（天气巡检等定时任务依赖单进程语义，避免多实例重复触发）
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],

      max_memory_restart: '192M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_file: './logs/combined.log',
      log_type: 'json',
      disable_logs: false,

      env: {
        NODE_ENV: 'development',
        PORT: 9015,
        NODE_OPTIONS: '--max-old-space-size=192'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 9015,
        NODE_OPTIONS: '--max-old-space-size=192'
      },

      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: false,

      pmx: true,
      automation: false,
      treekill: true,

      windowsHide: true,
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
    }
  ]
};
