import React from 'react';

interface LeadsFlowTabProps {
  sendMessage: <T>(message: any) => Promise<T>;
}

export default function LeadsFlowTab({ sendMessage }: LeadsFlowTabProps) {
  return (
    <div className="bg-white rounded-md p-6 border border-gray-200 shadow-sm h-[calc(100vh-100px)] flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Leads Flow</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          This page is ready for the upcoming Leads Flow functionality. 
          Awaiting further instructions to build out this section.
        </p>
      </div>
    </div>
  );
}
