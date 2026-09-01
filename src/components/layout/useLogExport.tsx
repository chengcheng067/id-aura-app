import { dump, exportLogs, logUser } from '../../core/services/log.service';

/**
 * 日志导出纯逻辑（桌面按钮 + 移动端「更多」菜单项共用，v0.4 抽取）。
 *
 * 单一实现，避免两边各写一份。调用方决定"何时提示、如何确认"：
 *   - 桌面 ExportLogButton：用返回条数 + 自带二次确认弹窗；
 *   - 移动菜单项：直接 export()（菜单点击即导出，减少无确认弹窗摩擦）。
 * 这样语义是「导出到本地文件」，非破坏性，无需强制二次确认。
 */
export interface LogExportIo {
  /** 当前日志条数（供前置提示） */
  count(): number;
  /** 直接导出：记录"导出日志"事件并下载 .log 文件，返回导出的条数 */
  export(): number;
}

export function createLogExportIo(): LogExportIo {
  return {
    count: () => dump().length,
    export: () => {
      const n = dump().length;
      logUser('日志', `导出日志（${n} 条）`);
      exportLogs();
      return n;
    },
  };
}
