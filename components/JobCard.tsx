import React from 'react';
import { Job, MatchLabel } from '../types';

interface JobCardProps {
  job: Job;
  onToggleSave: (jobId: string) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onToggleSave }) => {
  const getBadgeColor = (label: MatchLabel) => {
    switch (label) {
      case MatchLabel.STRONG:
        return 'bg-green-100 text-green-800 border-green-200';
      case MatchLabel.MEDIUM:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case MatchLabel.EXPLORATORY:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
      if (score >= 0.7) return 'text-green-600';
      if (score >= 0.4) return 'text-blue-600';
      return 'text-purple-600';
  }

  const companySearchUrl = `https://www.google.com/search?q=${encodeURIComponent(job.company)}`;

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-5 hover:shadow-md transition-all duration-200 relative ${job.saved ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-200'}`}>
      
      {/* Bookmark Button */}
      <button 
        onClick={() => onToggleSave(job.id)}
        className="absolute top-4 right-4 text-slate-300 hover:text-brand-500 transition-colors focus:outline-none"
        title={job.saved ? "Remove from saved" : "Save for later"}
      >
        {job.saved ? (
          <svg className="w-6 h-6 text-brand-500 drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
          </svg>
        )}
      </button>

      <div className="flex justify-between items-start mb-2 pr-10">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 leading-tight">
            {job.url !== '#' ? (
              <a 
                href={job.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-brand-600 hover:underline transition-colors"
              >
                {job.title}
              </a>
            ) : (
              job.title
            )}
          </h3>
          <a 
            href={companySearchUrl}
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-slate-600 font-medium hover:text-brand-600 hover:underline transition-colors block mt-1"
            title={`Search ${job.company} on Google`}
          >
            {job.company}
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
         <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(job.relevanceLabel)}`}>
          {job.relevanceLabel}
        </span>
        <span className="flex items-center text-sm text-slate-500">
            <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            {job.location}
        </span>
        {job.postedDate && (
            <span className="flex items-center text-sm text-slate-500">
                <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {job.postedDate}
            </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3">
          "{job.reason}"
        </p>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
           Relevance: <span className={`font-bold ${getScoreColor(job.relevanceScore)}`}>{(job.relevanceScore * 100).toFixed(0)}%</span>
        </div>
        <a 
          href={job.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`text-sm font-medium hover:underline ${job.url === '#' ? 'text-gray-400 cursor-not-allowed' : 'text-brand-600'}`}
          onClick={(e) => { if(job.url === '#') e.preventDefault(); }}
        >
          {job.url === '#' ? 'No Link Available' : 'Apply Now →'}
        </a>
      </div>
    </div>
  );
};

export default JobCard;