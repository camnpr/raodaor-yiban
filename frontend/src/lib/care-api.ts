import { apiFetch } from './api';
import type { AirQuality, DailyItem, HourlyItem, WeatherAlert, WeatherNow } from './weather-api';

/** 亲情守护领域类型（与后端 care.service.ts 对齐） */

export interface CareRelationship {
  id: string;
  /** 当前用户在关系中的角色：guardian=守护人（子女端），elder=长辈（被守护） */
  role: 'guardian' | 'elder';
  counterpartId: string;
  counterpartName: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface CareInvite {
  code: string;
  expiresAt: string;
}

export interface ElderSummary {
  elderId: string;
  displayName: string;
  cityName: string | null;
  hasCity: boolean;
  now: WeatherNow | null;
  alertCount: number;
}

export interface ElderWeather {
  elder: { id: string; displayName: string };
  city: { name: string; lat: number; lng: number } | null;
  now: WeatherNow | null;
  hourly: HourlyItem[];
  daily: DailyItem[];
  alerts: WeatherAlert[];
  aqi: AirQuality | null;
}

export interface ElderProfile {
  birthYear: number | null;
  cityId: string | null;
  cityName: string | null;
  note: string | null;
}

export interface CareProfileUpdate {
  birthYear?: number;
  cityId?: string;
  cityName?: string;
  note?: string;
}

// ---------- 亲情绑定（需登录） ----------

/** 守护人生成邀请码 */
export function createInvite(): Promise<CareInvite> {
  return apiFetch<CareInvite>('/care/invite', { method: 'POST' });
}

/** 长辈凭邀请码确认绑定 */
export function acceptInvite(code: string): Promise<CareRelationship> {
  return apiFetch<CareRelationship>('/care/accept', { method: 'POST', body: JSON.stringify({ code }) });
}

/** 当前用户的关系列表 */
export function listRelationships(): Promise<CareRelationship[]> {
  return apiFetch<CareRelationship[]>('/care/relationships');
}

/** 解除绑定 */
export function removeRelationship(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/care/${id}`, { method: 'DELETE' });
}

/** 守护中心：绑定长辈列表 + 天气摘要 */
export function listElders(): Promise<ElderSummary[]> {
  return apiFetch<ElderSummary[]>('/care/elders');
}

/** 长辈详情天气 */
export function getElderWeather(elderId: string): Promise<ElderWeather> {
  return apiFetch<ElderWeather>(`/care/elders/${elderId}/weather`);
}

/** 长辈轻量档案 */
export function getCareProfile(): Promise<ElderProfile> {
  return apiFetch<ElderProfile>('/care/profile');
}

/** 更新长辈档案 */
export function updateCareProfile(dto: CareProfileUpdate): Promise<ElderProfile> {
  return apiFetch<ElderProfile>('/care/profile', { method: 'PATCH', body: JSON.stringify(dto) });
}
