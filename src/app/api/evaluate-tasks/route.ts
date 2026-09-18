import { NextRequest, NextResponse } from "next/server";

interface EvaluateRequest {
  tasks: string[];
  transcript: { role: "user" | "assistant"; text: string }[];
  completedIndices?: number[];
}

export async function POST(req: NextRequest) {
  try {
    const { tasks, transcript, completedIndices = [] }: EvaluateRequest =
      await req.json();

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "Tasks array is required" },
        { status: 400 }
      );
    }

    const userTurns = transcript
      ?.filter((t) => t.role === "user")
      .map((t) => t.text.trim())
      .filter(Boolean) || [];

    const fullUserText = userTurns.join(" \n");

    // If there is an OpenAI API key, we can use an LLM for nuanced evaluation
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== "your_openai_api_key_here" && userTurns.length > 0) {
      try {
        const evaluationPrompt = `
You are an objective roleplay evaluator assessing whether the USER in a conversation has completed specific tasks.

TASKS TO EVALUATE:
${tasks.map((task, i) => `Task ${i}: "${task}"`).join("\n")}

USER'S CONVERSATION TRANSCRIPT (What the user said):
"""
${fullUserText}
"""

FULL CONVERSATION CONTEXT:
"""
${(transcript || [])
  .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
  .slice(-12)
  .join("\n")}
"""

PREVIOUSLY COMPLETED TASK INDICES: ${JSON.stringify(completedIndices)}

INSTRUCTIONS:
- Evaluate each task individually.
- Mark completed = true if the user clearly expressed or addressed the goal of the task (be conversational and forgiving of phrasing differences, but ensure the core intent was communicated).
- If a task was already marked completed previously in PREVIOUSLY COMPLETED TASK INDICES, maintain it as completed = true.
- Provide a concise (under 12 words) explanation in 'reason'.

Respond with ONLY a valid JSON object matching this schema:
{
  "taskStatuses": [
    {
      "index": 0,
      "completed": true,
      "reason": "Brief explanation"
    }
  ]
}
`.trim();

        const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  "You evaluate roleplay conversational task completion. Return JSON only.",
              },
              { role: "user", content: evaluationPrompt },
            ],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const content = llmData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.taskStatuses)) {
              const completedCount = parsed.taskStatuses.filter(
                (s: { completed: boolean }) => s.completed
              ).length;
              return NextResponse.json({
                taskStatuses: parsed.taskStatuses,
                completedCount,
                totalCount: tasks.length,
                allCompleted: completedCount === tasks.length,
              });
            }
          }
        }
      } catch (llmErr) {
        console.warn("LLM task evaluation fallback to heuristic matcher:", llmErr);
      }
    }

    // Heuristic / semantic keyword fallback matcher
    const taskStatuses = tasks.map((task, idx) => {
      // Retain previously completed tasks
      if (completedIndices.includes(idx)) {
        return {
          index: idx,
          completed: true,
          reason: "Completed in conversation",
        };
      }

      const taskWords = task
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !["them", "their", "your", "what", "that", "into", "from", "with", "have", "been", "were"].includes(w));

      const lowerUserText = fullUserText.toLowerCase();

      // Check keyword overlap percentage
      const matched = taskWords.filter((word) => lowerUserText.includes(word));
      const overlapRatio = taskWords.length > 0 ? matched.length / taskWords.length : 0;

      const isCompleted = overlapRatio >= 0.45 || (matched.length >= 3 && userTurns.length >= 2);

      return {
        index: idx,
        completed: isCompleted,
        reason: isCompleted
          ? "Intent recognized from conversation"
          : "Not yet addressed in conversation",
      };
    });

    const completedCount = taskStatuses.filter((s) => s.completed).length;

    return NextResponse.json({
      taskStatuses,
      completedCount,
      totalCount: tasks.length,
      allCompleted: completedCount === tasks.length,
    });
  } catch (err) {
    console.error("Task evaluation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal evaluation error" },
      { status: 500 }
    );
  }
}
