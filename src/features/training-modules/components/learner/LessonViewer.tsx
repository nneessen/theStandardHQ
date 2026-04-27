import { Loader2 } from "lucide-react";
import { useTrainingLessonWithContent } from "../../hooks/useTrainingLessons";
import { ContentBlockRenderer } from "./ContentBlockRenderer";
import { QuizPlayer } from "./QuizPlayer";

interface LessonViewerProps {
  lessonId: string;
}

export function LessonViewer({ lessonId }: LessonViewerProps) {
  const { data: lesson, isLoading } = useTrainingLessonWithContent(lessonId);

  if (isLoading || !lesson) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  // Quiz lesson — always take this branch for quiz-type lessons.
  // If the quiz row hasn't been created yet (e.g., admin created the lesson
  // but never clicked "Create Quiz" in the builder), show a placeholder so
  // the page isn't silently empty.
  if (lesson.lesson_type === "quiz") {
    if (!lesson.quiz) {
      return (
        <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
          <h2 className="text-base font-semibold text-v2-ink dark:text-v2-ink">
            {lesson.title}
          </h2>
          <p className="text-xs text-v2-ink-muted">
            This quiz hasn't been set up yet. Please check back later or contact
            your trainer.
          </p>
        </div>
      );
    }
    return (
      <QuizPlayer
        quiz={lesson.quiz}
        lessonId={lessonId}
        moduleId={lesson.module_id}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-v2-ink dark:text-v2-ink">
          {lesson.title}
        </h2>
        {lesson.description && (
          <p className="text-xs text-v2-ink-muted mt-0.5">
            {lesson.description}
          </p>
        )}
      </div>

      {lesson.content_blocks.map((block) => (
        <ContentBlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
