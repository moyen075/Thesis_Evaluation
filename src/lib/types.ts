export type Role = "ADMIN" | "TEACHER";
export type AIAgent = "GEMINI" | "LLAMA";
export type FactorKey =
  | "content_relevance"
  | "organization_cohesion"
  | "lexis_academic_register"
  | "grammar_mechanics";
export type TaskStatus =
  | "NOT_STARTED"
  | "PHASE_1_COMPLETE"
  | "PHASE_2_COMPLETE"
  | "ARCHIVED";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const RUBRIC_FACTORS: Array<{
  key: FactorKey;
  label: string;
  maxScore: number;
  levels: Array<{ score: number; text: string }>;
}> = [
  {
    key: "content_relevance",
    label: "Content & Relevance",
    maxScore: 3,
    levels: [
      {
        score: 3,
        text: "Exceptional: defines fake news in the social media context and gives sophisticated impact analysis with a real-world example.",
      },
      {
        score: 2,
        text: "Competent: addresses the prompt well but may be generic or miss social media-specific mechanisms.",
      },
      {
        score: 1,
        text: "Emerging: vague or surface-level; lacks example or meaningful impact analysis.",
      },
    ],
  },
  {
    key: "organization_cohesion",
    label: "Organization & Cohesion",
    maxScore: 2,
    levels: [
      {
        score: 2,
        text: "Strong PEE structure with clear topic sentence and seamless transitions.",
      },
      {
        score: 1,
        text: "Functional beginning, middle, and end, but flow is clunky or topic sentence is weak.",
      },
      {
        score: 0.5,
        text: "Disorganized ideas without a cohesive argument or logical progression.",
      },
    ],
  },
  {
    key: "lexis_academic_register",
    label: "Lexis & Academic Register",
    maxScore: 2.5,
    levels: [
      {
        score: 2.5,
        text: "Precise academic vocabulary and technical terms with a formal, objective stance.",
      },
      {
        score: 1.5,
        text: "Appropriate standard vocabulary, but limited academic or field-specific terminology.",
      },
      {
        score: 0.5,
        text: "Informal, conversational, slangy, or overly emotional language.",
      },
    ],
  },
  {
    key: "grammar_mechanics",
    label: "Grammar & Mechanics",
    maxScore: 2.5,
    levels: [
      {
        score: 2.5,
        text: "Highly accurate grammar, punctuation, spelling, capitalization, and sentence structure.",
      },
      {
        score: 1.5,
        text: "Minor issues that do not impede meaning.",
      },
      {
        score: 0.5,
        text: "Pervasive errors that make the paragraph difficult to read.",
      },
    ],
  },
];

export const FACTOR_OPTIONS = {
  ai_more_accurate:
    "The AI's score is more accurate; its feedback highlighted valid points I initially overlooked.",
  human_more_accurate:
    "My initial score is more accurate; the AI's feedback is unconvincing, flawed, or misinterprets the text.",
  both_acceptable:
    "The scores are different, but both interpretations are acceptable and pedagogically sound.",
} as const;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: Role;
          created_at: string;
          updated_at: string;
        };
      };
      paragraphs: {
        Row: {
          id: string;
          paragraph_id: string;
          paragraph_text: string;
          legacy_initial_score: number | null;
          raw_yaml: Json;
          created_at: string;
          updated_at: string;
        };
      };
      ai_evaluations: {
        Row: {
          id: string;
          paragraph_id: string;
          agent: AIAgent;
          total_score: number;
          raw_feedback: string;
          corrective_feedback: Json;
          improvement_feedback: Json;
          parse_warnings: string[] | null;
          created_at: string;
          updated_at: string;
        };
      };
      ai_factor_scores: {
        Row: {
          id: string;
          ai_evaluation_id: string;
          factor_key: FactorKey;
          factor_label: string;
          score: number;
          max_score: number;
          reason: string;
        };
      };
      teacher_tasks: {
        Row: {
          id: string;
          paragraph_id: string;
          teacher_id: string;
          status: TaskStatus;
          assigned_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
      };
      human_evaluations: {
        Row: {
          id: string;
          task_id: string;
          total_score: number;
          submitted_at: string;
        };
      };
      human_factor_scores: {
        Row: {
          id: string;
          human_evaluation_id: string;
          factor_key: FactorKey;
          score: number;
          max_score: number;
          notes: string | null;
        };
      };
      ai_review_answers: {
        Row: {
          id: string;
          task_id: string;
          ai_evaluation_id: string;
          agent: AIAgent;
          analytical_answers: Json;
          actionability_score: number;
          tone_register_score: number;
          hallucinated_errors: boolean;
          submitted_at: string;
        };
      };
    };
  };
}

