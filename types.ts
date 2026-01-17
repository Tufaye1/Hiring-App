export enum MatchLabel {
  STRONG = 'Strong Match',
  MEDIUM = 'Medium Match',
  EXPLORATORY = 'Exploratory',
  WEAK = 'Weak Match'
}

export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  dateFound: string; // ISO date string
  postedDate?: string;
  relevanceScore: number;
  relevanceLabel: MatchLabel;
  reason: string;
  source?: string;
  saved?: boolean;
}

export interface ScanResult {
  jobs: Job[];
  timestamp: string;
}

export interface ProfileContext {
  background: string[];
  skills: string[];
  interests: string[];
  intent: string[];
}

export interface SyncResult {
  success: boolean;
  message: string;
  newJobsAdded: number;
}