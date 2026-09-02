/**
 * REST 适配器：fetch 封装 + 七个远端仓储实现（路由严格照 docs/api-contract.md）。
 * HTTP/网络错误统一翻译为 ChangxiaError（铁律 5）。
 * 预留 Authorization header 位（待确认 7：局域网信任，token 留空即可）。
 */

import type {
  IRepositoryBundle,
  RepositoryFactoryConfig,
  IProjectsRepository,
  IStagesRepository,
  ITasksRepository,
  IMembersRepository,
  ILogsRepository,
  IContractsRepository,
  ISettingsRepository,
  IAdminRepository,
} from '../interfaces';
import type {
  CreateMemberCmd,
  CreateProjectCmd,
  CreateTaskCmd,
  UpdateMemberCmd,
  UpdateProjectCmd,
  UpdateStageCmd,
  UpdateTaskCmd,
  BackupPackage,
} from '../../types/dto';
import type {
  AssignmentLog,
  ContractRecord,
  Member,
  Project,
  Setting,
  Stage,
  StageLog,
  Task,
} from '../../types/entities';
import { ChangxiaError, ChangxiaErrorCode, StageStatus } from '../../types/enums';
import type { ProjectQuery, TaskQuery } from '../interfaces';

/* --------------------------------- fetch 封装 --------------------------------- */

export class RestClient {
  public constructor(
    private readonly baseUrl: string,
    /** 预留位：未来 Docker 化后填简单 token */
    private readonly authToken: string = '',
    private readonly timeoutMs: number = 8000,
  ) {}

  public async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ChangxiaError(
        ChangxiaErrorCode.Network,
        '无法连接到服务器，请检查局域网地址配置。',
        err,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let userMessage = `服务端错误（HTTP ${res.status}）`;
      try {
        const payload = (await res.json()) as { error?: { userMessage?: string } };
        if (payload?.error?.userMessage) userMessage = payload.error.userMessage;
      } catch {
        /* 非 JSON 错误体保持默认文案 */
      }
      throw new ChangxiaError(
        res.status === 404 ? ChangxiaErrorCode.NotFound : ChangxiaErrorCode.Network,
        userMessage,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  public get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }
  public post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
  public patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
  public put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
  public delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

const qs = (params: Record<string, string | number | boolean | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
};

/* ------------------------------- 远端仓储实现 ------------------------------- */

export class RemoteProjectsRepository implements IProjectsRepository {
  public constructor(private readonly api: RestClient) {}

  list(query?: ProjectQuery): Promise<Project[]> {
    return this.api.get(`/projects${qs({ status: query?.status, keyword: query?.keyword })}`);
  }
  get(id: string): Promise<Project | null> {
    return this.api.get(`/projects/${id}`);
  }
  insert(cmd: CreateProjectCmd & { id?: string }): Promise<Project> {
    return this.api.post('/projects', cmd);
  }
  update(id: string, cmd: UpdateProjectCmd): Promise<Project> {
    return this.api.patch(`/projects/${id}`, cmd);
  }
  archive(id: string, archived: boolean): Promise<void> {
    return this.api.post(`/projects/${id}/archive`, { archived });
  }
  remove(id: string): Promise<void> {
    return this.api.delete(`/projects/${id}`);
  }
}

export class RemoteStagesRepository implements IStagesRepository {
  public constructor(private readonly api: RestClient) {}

  async listByProject(projectId: string): Promise<Stage[]> {
    const rows = await this.api.get<Stage[]>(`/projects/${projectId}/stages`);
    return rows.sort((a, b) => a.orderIndex - b.orderIndex);
  }
  get(id: string): Promise<Stage | null> {
    return this.api.get(`/stages/${id}`);
  }
  bulkInsert(rows: Stage[]): Promise<void> {
    return this.api.post('/stages/bulk', { rows });
  }
  update(id: string, cmd: UpdateStageCmd): Promise<Stage> {
    return this.api.patch(`/stages/${id}`, cmd);
  }
  reschedule(id: string, startAt: string, endAt: string, status?: StageStatus): Promise<Stage> {
    return this.api.post(`/stages/${id}/reschedule`, { startAt, endAt, status });
  }
}

export class RemoteTasksRepository implements ITasksRepository {
  public constructor(private readonly api: RestClient) {}

  list(query?: TaskQuery): Promise<Task[]> {
    return this.api.get(
      `/tasks${qs({
        projectId: query?.projectId,
        stageId: query?.stageId,
        assigneeId: query?.assigneeId,
        done: query?.done,
      })}`,
    );
  }
  listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }
  listByAssignee(memberId: string): Promise<Task[]> {
    return this.list({ assigneeId: memberId });
  }
  bulkInsert(rows: Task[]): Promise<void> {
    return this.api.post('/tasks/bulk', { rows });
  }
  insert(cmd: CreateTaskCmd): Promise<Task> {
    return this.api.post('/tasks', cmd);
  }
  update(id: string, cmd: UpdateTaskCmd): Promise<Task> {
    return this.api.patch(`/tasks/${id}`, cmd);
  }
  remove(id: string): Promise<void> {
    return this.api.delete(`/tasks/${id}`);
  }
}

export class RemoteMembersRepository implements IMembersRepository {
  public constructor(private readonly api: RestClient) {}

  list(includeInactive?: boolean): Promise<Member[]> {
    return this.api.get(`/members${qs({ includeInactive: includeInactive ? 1 : undefined })}`);
  }
  get(id: string): Promise<Member | null> {
    return this.api.get(`/members/${id}`);
  }
  insert(cmd: CreateMemberCmd): Promise<Member> {
    return this.api.post('/members', cmd);
  }
  update(id: string, cmd: UpdateMemberCmd): Promise<Member> {
    return this.api.patch(`/members/${id}`, cmd);
  }
  /** 密码校验：POST /api/members/verify { memberId, password } → 200/401（服务端 scrypt 比对） */
  async verifyCredentials(memberId: string, password: string): Promise<boolean> {
    try {
      await this.api.post('/members/verify', { memberId, password });
      return true;
    } catch {
      // 401（密码错误）或任何失败 → false；由调用方给出用户名/密码错误提示
      return false;
    }
  }
}

export class RemoteLogsRepository implements ILogsRepository {
  public constructor(private readonly api: RestClient) {}

  appendStageLog(log: Omit<StageLog, 'id' | 'createdAt'>): Promise<StageLog> {
    return this.api.post('/logs/stage', log);
  }
  listStageLogsByStage(stageId: string): Promise<StageLog[]> {
    return this.api.get(`/stages/${stageId}/logs`);
  }
  listStageLogsByProject(projectId: string): Promise<StageLog[]> {
    return this.api.get(`/projects/${projectId}/logs`);
  }
  appendAssignment(log: Omit<AssignmentLog, 'id' | 'createdAt'>): Promise<AssignmentLog> {
    return this.api.post('/logs/assignments', log);
  }
  listAssignmentsByTask(taskId: string): Promise<AssignmentLog[]> {
    return this.api.get(`/tasks/${taskId}/assignments`);
  }
}

export class RemoteContractsRepository implements IContractsRepository {
  public constructor(private readonly api: RestClient) {}

  insert(row: Omit<ContractRecord, 'id' | 'createdAt'> & { id?: string }): Promise<ContractRecord> {
    return this.api.post('/contracts', row);
  }
  get(id: string): Promise<ContractRecord | null> {
    return this.api.get(`/contracts/${id}`);
  }
  linkProject(contractId: string, projectId: string): Promise<void> {
    return this.api.post(`/contracts/${contractId}/link-project`, { projectId });
  }
  saveConfirmedPayload(contractId: string, confirmedJson: string): Promise<void> {
    return this.api.post(`/contracts/${contractId}/confirmed-payload`, { confirmedJson });
  }
  list(): Promise<ContractRecord[]> {
    return this.api.get('/contracts');
  }
}

export class RemoteSettingsRepository implements ISettingsRepository {
  public constructor(private readonly api: RestClient) {}

  async get<T>(key: string): Promise<T | null> {
    const row = await this.api.get<{ key: string; valueJson: string } | null>(`/settings/${key}`);
    return row ? (JSON.parse(row.valueJson) as T) : null;
  }
  set(key: string, valueJson: unknown): Promise<void> {
    return this.api.put(`/settings/${key}`, { valueJson });
  }
  all(): Promise<Setting[]> {
    return this.api.get('/settings');
  }
  replaceAll(rows: Setting[]): Promise<void> {
    return this.api.post('/settings/replace-all', { rows });
  }
}

class RemoteAdminRepository implements IAdminRepository {
  public constructor(private readonly api: RestClient) {}

  fullExport(): Promise<BackupPackage> {
    return this.api.get('/backup');
  }
  replaceAllImport(pkg: BackupPackage): Promise<void> {
    return this.api.post('/backup/import', pkg);
  }
}

/* --------------------------------- 工厂出口 --------------------------------- */

/** remote bundle 装配（rest.client 同时承担 createRemoteRepositories 职责） */
export function createRemoteRepositories(apiBaseUrl: string): IRepositoryBundle {
  if (!apiBaseUrl) {
    throw new ChangxiaError(
      ChangxiaErrorCode.Network,
      '启用 remote 数据源时必须配置 VITE_API_BASE_URL。',
    );
  }
  const api = new RestClient(apiBaseUrl.replace(/\/+$/, ''));
  return {
    projects: new RemoteProjectsRepository(api),
    stages: new RemoteStagesRepository(api),
    tasks: new RemoteTasksRepository(api),
    members: new RemoteMembersRepository(api),
    logs: new RemoteLogsRepository(api),
    contracts: new RemoteContractsRepository(api),
    settings: new RemoteSettingsRepository(api),
    admin: new RemoteAdminRepository(api),
  };
}

/** RepositoryFactoryConfig 再导出（工厂 index.ts 引用对称） */
export type { RepositoryFactoryConfig };
