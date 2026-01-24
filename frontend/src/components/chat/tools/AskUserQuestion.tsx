import React, { useState, useCallback } from 'react';
import { HelpCircle, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ToolAggregate, UserQuestion } from '@/types';
import { ToolCard } from './common';
import { useUserQuestion } from '@/hooks/useUserQuestion';

const LETTER_OPTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OTHER_VALUE = '__other__';

interface AskUserQuestionInlineProps {
  questions: UserQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

function AskUserQuestionInline({
  questions,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
}: AskUserQuestionInlineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  const currentKey = `question_${currentIndex}`;
  const currentAnswer = answers[currentKey];
  const currentOtherInput = otherInputs[currentKey]?.trim();
  const isOtherSelected = Array.isArray(currentAnswer)
    ? currentAnswer.includes(OTHER_VALUE)
    : currentAnswer === OTHER_VALUE;
  const hasCurrentAnswer =
    (currentAnswer &&
      currentAnswer !== OTHER_VALUE &&
      (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true)) ||
    (isOtherSelected && !!currentOtherInput);

  const handleOptionSelect = useCallback(
    (optionLabel: string) => {
      const key = `question_${currentIndex}`;
      const isMultiSelect = currentQuestion?.multiSelect ?? false;

      if (isMultiSelect) {
        const current = (answers[key] as string[]) ?? [];
        if (optionLabel === OTHER_VALUE) {
          if (current.includes(OTHER_VALUE)) {
            setAnswers({ ...answers, [key]: current.filter((o) => o !== OTHER_VALUE) });
          } else {
            setAnswers({ ...answers, [key]: [OTHER_VALUE] });
          }
        } else {
          const filtered = current.filter((o) => o !== OTHER_VALUE);
          if (filtered.includes(optionLabel)) {
            setAnswers({ ...answers, [key]: filtered.filter((o) => o !== optionLabel) });
          } else {
            setAnswers({ ...answers, [key]: [...filtered, optionLabel] });
          }
        }
      } else {
        setAnswers({ ...answers, [key]: optionLabel });
        if (optionLabel !== OTHER_VALUE) {
          setOtherInputs({ ...otherInputs, [key]: '' });
          // Auto-advance to next question after selection
          if (currentIndex < totalQuestions - 1) {
            setTimeout(() => setCurrentIndex((prev) => prev + 1), 150);
          }
        }
      }
    },
    [answers, otherInputs, currentIndex, currentQuestion?.multiSelect, totalQuestions],
  );

  const handleOtherInputChange = useCallback(
    (value: string) => {
      const key = `question_${currentIndex}`;
      setOtherInputs({ ...otherInputs, [key]: value });
    },
    [otherInputs, currentIndex],
  );

  const handleSubmit = useCallback(() => {
    const finalAnswers: Record<string, string | string[]> = {};
    questions.forEach((q, qIndex) => {
      const key = `question_${qIndex}`;
      const selectedAnswer = answers[key];
      const otherInput = otherInputs[key]?.trim();
      const isMultiSelect = q.multiSelect ?? false;

      if (isMultiSelect) {
        const selected = Array.isArray(selectedAnswer) ? selectedAnswer : [];
        const next = [...selected];
        if (selected.includes(OTHER_VALUE)) {
          const withoutOther = next.filter((value) => value !== OTHER_VALUE);
          if (otherInput) {
            withoutOther.push(otherInput);
          }
          if (withoutOther.length > 0) {
            finalAnswers[key] = withoutOther;
          }
        } else if (next.length > 0) {
          finalAnswers[key] = next;
        }
      } else {
        if (selectedAnswer === OTHER_VALUE && otherInput) {
          finalAnswers[key] = otherInput;
        } else if (selectedAnswer && selectedAnswer !== OTHER_VALUE) {
          finalAnswers[key] = selectedAnswer as string;
        }
      }
    });
    onSubmit(finalAnswers);
  }, [answers, otherInputs, onSubmit, questions]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1);
  }, [currentIndex, totalQuestions]);

  const isSelected = (optionLabel: string) => {
    const key = `question_${currentIndex}`;
    const answer = answers[key];
    if (Array.isArray(answer)) return answer.includes(optionLabel);
    return answer === optionLabel;
  };

  if (!currentQuestion) return null;

  const optionsCount = currentQuestion.options?.length ?? 0;
  const otherLetter = LETTER_OPTIONS[optionsCount] || String(optionsCount + 1);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-tertiary dark:border-border-dark dark:bg-surface-dark-tertiary">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 dark:border-border-dark/50">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-black/5 p-1 dark:bg-white/5">
            <HelpCircle className="h-3.5 w-3.5 text-text-tertiary dark:text-text-dark-tertiary" />
          </div>
          <span className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
            Questions
          </span>
        </div>
        {totalQuestions > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevious}
              disabled={currentIndex === 0 || isLoading}
              className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-black/5 hover:text-text-secondary disabled:opacity-30 dark:text-text-dark-tertiary dark:hover:bg-white/5 dark:hover:text-text-dark-secondary"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs text-text-tertiary dark:text-text-dark-tertiary">
              {currentIndex + 1} of {totalQuestions}
            </span>
            <button
              type="button"
              onClick={goToNext}
              disabled={currentIndex === totalQuestions - 1 || isLoading}
              className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-black/5 hover:text-text-secondary disabled:opacity-30 dark:text-text-dark-tertiary dark:hover:bg-white/5 dark:hover:text-text-dark-secondary"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="mb-3 flex items-start gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
            {currentIndex + 1}.
          </span>
          <div>
            <p className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
              {currentQuestion.question}
            </p>
            {currentQuestion.multiSelect && (
              <span className="mt-1 inline-block rounded bg-black/5 px-1.5 py-0.5 text-2xs font-medium text-text-tertiary dark:bg-white/5 dark:text-text-dark-tertiary">
                Select multiple
              </span>
            )}
          </div>
        </div>

        {currentQuestion.options && currentQuestion.options.length > 0 && (
          <div className="space-y-1">
            {currentQuestion.options.map((option, oIndex) => {
              const letter = LETTER_OPTIONS[oIndex] || String(oIndex + 1);
              const selected = isSelected(option.label);
              return (
                <button
                  key={oIndex}
                  type="button"
                  onClick={() => handleOptionSelect(option.label)}
                  className={`group flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-all ${
                    selected
                      ? 'bg-black/5 dark:bg-white/5'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  disabled={isLoading}
                >
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-medium ${
                      selected
                        ? 'bg-text-primary text-surface dark:bg-text-dark-primary dark:text-surface-dark'
                        : 'bg-black/5 text-text-tertiary dark:bg-white/5 dark:text-text-dark-tertiary'
                    }`}
                  >
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs transition-colors ${
                        selected
                          ? 'font-medium text-text-primary dark:text-text-dark-primary'
                          : 'text-text-secondary dark:text-text-dark-secondary'
                      }`}
                    >
                      {option.label}
                    </p>
                    {option.description && (
                      <p className="mt-0.5 text-2xs text-text-tertiary dark:text-text-dark-tertiary">
                        {option.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            <div
              onClick={() => handleOptionSelect(OTHER_VALUE)}
              className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-all ${
                isOtherSelected
                  ? 'bg-black/5 dark:bg-white/5'
                  : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-medium ${
                  isOtherSelected
                    ? 'bg-text-primary text-surface dark:bg-text-dark-primary dark:text-surface-dark'
                    : 'bg-black/5 text-text-tertiary dark:bg-white/5 dark:text-text-dark-tertiary'
                }`}
              >
                {otherLetter}
              </span>
              {isOtherSelected ? (
                <input
                  type="text"
                  placeholder="Type your answer..."
                  value={otherInputs[currentKey] ?? ''}
                  onChange={(e) => handleOtherInputChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 bg-transparent text-xs text-text-primary placeholder-text-tertiary outline-none dark:text-text-dark-primary dark:placeholder-text-dark-tertiary"
                  disabled={isLoading}
                  autoFocus
                />
              ) : (
                <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                  Other
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 dark:border-border-dark/50">
        <div>
          {error && (
            <div className="flex items-center gap-2 text-2xs text-error-600 dark:text-error-400">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onCancel}
            variant="unstyled"
            disabled={isLoading}
            className="px-2.5 py-1 text-xs text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={isLoading || !hasCurrentAnswer}
            className="px-3 py-1 text-xs"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AskUserQuestionProps {
  tool: ToolAggregate;
  chatId?: string;
}

export const AskUserQuestion: React.FC<AskUserQuestionProps> = ({ tool, chatId }) => {
  const questions = (tool.input?.questions ?? []) as UserQuestion[];
  const questionCount = questions.length;
  const toolStatus = tool.status;
  const errorMessage = tool.error;

  const {
    pendingRequest,
    isLoading,
    error: questionError,
    handleSubmitAnswers,
    handleCancel,
  } = useUserQuestion(chatId);

  const resultData = tool.result as { answers?: Record<string, string | string[]> } | undefined;
  const answers = resultData?.answers;

  const isPending = toolStatus === 'started' && pendingRequest !== null;

  if (isPending && questionCount > 0) {
    return (
      <AskUserQuestionInline
        questions={questions}
        onSubmit={handleSubmitAnswers}
        onCancel={handleCancel}
        isLoading={isLoading}
        error={questionError}
      />
    );
  }

  return (
    <ToolCard
      icon={<HelpCircle className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={toolStatus}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `User answered ${questionCount} question${questionCount !== 1 ? 's' : ''}`;
          case 'failed':
            return 'Question cancelled or failed';
          default:
            return 'Waiting for user response...';
        }
      }}
      loadingContent="Waiting for response..."
      error={errorMessage}
      expandable={questionCount > 0 && toolStatus === 'completed' && !!answers}
    >
      {questionCount > 0 && toolStatus === 'completed' && answers && (
        <div className="border-t border-border/50 p-3 dark:border-border-dark/50">
          <div className="space-y-3">
            {questions.map((q, index) => {
              const answer = answers[`question_${index}`];
              return (
                <div key={index} className="space-y-1">
                  <p className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                    {q.header && (
                      <span className="text-brand-600 dark:text-brand-400">{q.header}: </span>
                    )}
                    {q.question}
                  </p>
                  {answer && (
                    <p className="border-l-2 border-brand-500 pl-2 text-xs text-text-secondary dark:text-text-dark-secondary">
                      {Array.isArray(answer) ? answer.join(', ') : answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ToolCard>
  );
};
