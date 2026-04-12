'use client';

import { useState, useCallback } from 'react';
import { HumanizerSettings, HumanizerResult, DetectionReport as DetectionReportType, PipelineStep } from '@/types';
import { humanizeText } from '@/lib/humanizer';
import { detectAIPatterns } from '@/lib/detector';
import InputPanel from '@/components/InputPanel';
import OutputPanel from '@/components/OutputPanel';
import DetectionReport from '@/components/DetectionReport';
import SettingsBar from '@/components/SettingsBar';
import ProgressSteps from '@/components/ProgressSteps';

const PIPELINE_LABELS = [
  'Removing artifacts',
  'Replacing vocabulary',
  'Applying synonyms',
  'Fixing formatting',
  'Fixing language patterns',
  'Removing preambles',
  'Fixing morphology',
  'Diversifying n-grams',
  'Diversifying starters',
  'Restructuring sentences',
  'Engineering burstiness',
  'Injecting variety',
  'Adding natural flow',
  'Diversifying punctuation',
  'Cleaning adverbs',
  'Validating semantics',
  'Checking naturalness',
  'Fixing integrity',
  'Refining tone',
  'Injecting imperfections',
];

function createSteps(): PipelineStep[] {
  return PIPELINE_LABELS.map((label, i) => ({
    id: i,
    label,
    status: 'pending' as const,
  }));
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<HumanizerSettings>({
    imperfectionLevel: 'moderate',
    burstinessMode: 'strong',
    randomSpacingEnabled: true,
    randomSpacingIntensity: 'medium',
    professionalMode: false,
  });
  const [detectionReport, setDetectionReport] = useState<DetectionReportType | null>(null);
  const [humanizerResult, setHumanizerResult] = useState<HumanizerResult | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(createSteps());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = useCallback(() => {
    if (!inputText.trim()) return;
    const report = detectAIPatterns(inputText);
    setDetectionReport(report);
  }, [inputText]);

  const handleHumanize = useCallback(async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);

    // Reset steps
    const steps = createSteps();
    setPipelineSteps(steps);

    // Run detection first
    const report = detectAIPatterns(inputText);
    setDetectionReport(report);

    try {
      const result = await humanizeText(inputText, settings, (stepIndex) => {
        setPipelineSteps(prev =>
          prev.map((step, i) => ({
            ...step,
            status: i < stepIndex ? 'complete' : i === stepIndex ? 'active' : 'pending',
          }))
        );
      });

      // Mark all steps complete
      setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'complete' as const })));
      setHumanizerResult(result);

      // Run detection on the output to show the improvement
      const outputReport = detectAIPatterns(result.finalText);
      setDetectionReport(outputReport);
    } catch (error) {
      console.error('Humanization failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, settings]);

  const handleClear = useCallback(() => {
    setInputText('');
    setDetectionReport(null);
    setHumanizerResult(null);
    setPipelineSteps(createSteps());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">HumanizeAI</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Pure Algorithmic
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Transform AI-generated text into natural, human-sounding prose
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 space-y-4">
        {/* Settings Bar */}
        <SettingsBar
          settings={settings}
          onSettingsChange={setSettings}
          onHumanize={handleHumanize}
          onClear={handleClear}
          isProcessing={isProcessing}
          hasInput={!!inputText.trim()}
        />

        {/* Progress Steps */}
        <ProgressSteps steps={pipelineSteps} visible={isProcessing || humanizerResult !== null} />

        {/* Two-column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Input + Detection */}
          <div className="space-y-4">
            <InputPanel
              text={inputText}
              onTextChange={setInputText}
              onScan={handleScan}
              isProcessing={isProcessing}
            />
            <DetectionReport report={detectionReport} />
          </div>

          {/* Right Column: Output */}
          <div>
            <OutputPanel
              originalText={inputText}
              outputText={humanizerResult?.finalText || ''}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
          <p className="text-xs text-gray-400 text-center">
            This tool improves writing style and naturalness. Always review output before use.
          </p>
        </div>
      </footer>
    </div>
  );
}
