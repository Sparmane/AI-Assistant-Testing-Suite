import React, { useState } from 'react';
import { TestResult, EvaluationResult, TestStatus, EvaluationCategory, BiasCriteria, SafetyCriteria, RelevanceCriteria, EvaluationCriterion } from '../types';
import { CheckCircleIcon, CrossCircleIcon, ClockIcon, AlertTriangleIcon, ChevronDownIcon } from './Icons';

const getStatusIcon = (status: TestStatus) => {
    switch (status) {
        case TestStatus.Pass:
            return <CheckCircleIcon className="text-green-400" />;
        case TestStatus.Fail:
            return <CrossCircleIcon className="text-red-400" />;
        case TestStatus.Error:
            return <AlertTriangleIcon className="text-yellow-400" />;
        case TestStatus.Pending:
            return <ClockIcon className="text-gray-400 animate-spin" />;
    }
};

const getCategoryStatus = (evaluations: EvaluationResult[], criteria: readonly EvaluationCriterion[]): TestStatus => {
    const categoryEvals = evaluations.filter(e => criteria.includes(e.type));
    if (categoryEvals.some(e => e.status === TestStatus.Error)) return TestStatus.Error;
    if (categoryEvals.some(e => e.status === TestStatus.Pending)) return TestStatus.Pending;
    if (categoryEvals.some(e => e.status === TestStatus.Fail)) return TestStatus.Fail;
    if (categoryEvals.length < criteria.length) return TestStatus.Pending; // Not all tests are in yet
    return TestStatus.Pass;
};


const ResultRow: React.FC<{ result: TestResult }> = ({ result }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const categoryStatuses = {
        [EvaluationCategory.Bias]: getCategoryStatus(result.evaluations, BiasCriteria),
        [EvaluationCategory.Safety]: getCategoryStatus(result.evaluations, SafetyCriteria),
        [EvaluationCategory.Relevance]: getCategoryStatus(result.evaluations, RelevanceCriteria),
    };

    const renderDetailGroup = (title: string, criteria: readonly EvaluationCriterion[]) => (
        <div>
            <h5 className="font-semibold text-gray-300 mb-3 text-lg">{title}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {criteria.map(criterion => {
                    const ev = result.evaluations.find(e => e.type === criterion);
                    if (!ev) return null;
                    return (
                        <div key={ev.type} className="bg-gray-800 p-4 rounded-md border border-gray-700">
                            <h6 className="font-bold flex items-center gap-2">{getStatusIcon(ev.status)} {ev.type}</h6>
                            {ev.reason && <p className="text-sm text-gray-400 mt-2">{ev.reason}</p>}
                        </div>
                    )
                })}
            </div>
        </div>
    );
    
    return (
        <>
            <tr 
              className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
                <td className="px-6 py-4 font-medium text-gray-200">
                    <div className="flex items-center">
                        <ChevronDownIcon className={`w-5 h-5 mr-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        {result.question}
                    </div>
                </td>
                {Object.values(EvaluationCategory).map(category => (
                    <td key={category} className="px-6 py-4 text-center">
                        {getStatusIcon(categoryStatuses[category])}
                    </td>
                ))}
                <td className="px-6 py-4 font-semibold text-center text-lg">
                    <span className={result.passScore >= 80 ? 'text-green-400' : result.passScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                        {result.passScore.toFixed(0)}%
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-800/50">
                    <td colSpan={5} className="p-0">
                        <div className="p-6 bg-gray-900/50 animate-fade-in">
                            <h4 className="font-semibold text-gray-300 mb-2">Generated Answer:</h4>
                            <p className="text-gray-400 whitespace-pre-wrap font-mono text-sm bg-black/30 p-4 rounded-md mb-6">{result.generatedAnswer}</p>
                            
                            <div className="space-y-6">
                                {renderDetailGroup('Bias Evaluation', BiasCriteria)}
                                {renderDetailGroup('Safety Evaluation', SafetyCriteria)}
                                {renderDetailGroup('Relevance Evaluation', RelevanceCriteria)}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

const ResultsTable: React.FC<{ results: TestResult[] }> = ({ results }) => {
  return (
    <div className="relative overflow-x-auto shadow-2xl shadow-indigo-500/10 sm:rounded-lg border border-gray-700">
      <table className="w-full text-sm text-left text-gray-400">
        <thead className="text-xs text-gray-300 uppercase bg-gray-700/50">
          <tr>
            <th scope="col" className="px-6 py-3">
              Test Question
            </th>
            <th scope="col" className="px-6 py-3 text-center">
              Bias
            </th>
            <th scope="col" className="px-6 py-3 text-center">
              Safety
            </th>
            <th scope="col" className="px-6 py-3 text-center">
              Relevance
            </th>
            <th scope="col" className="px-6 py-3 text-center">
              Pass Score
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map(result => (
            <ResultRow key={result.id} result={result} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
