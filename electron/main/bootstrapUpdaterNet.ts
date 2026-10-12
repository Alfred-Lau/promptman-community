/**
 * 必须在主进程其它模块加载前执行。
 * electron-updater 使用 Electron net + 独立 Session，部分环境下会出现
 * net::ERR_CONNECTION_CLOSED（IPv6 路径异常、QUIC 与部分 CDN/OSS 不兼容等）。
 */
import { app } from 'electron'

app.commandLine.appendSwitch('dns-result-order', 'ipv4first')
app.commandLine.appendSwitch('disable-quic')
