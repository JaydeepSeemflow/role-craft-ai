import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "your_openai_api_key_here") {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add it to .env.local" },
      { status: 500 }
    );
  }

  try {
    const { scenario, voice, sdp, model } = await req.json();

    if (!sdp) {
      return NextResponse.json(
        { error: "Missing SDP offer in request body" },
        { status: 400 }
      );
    }

    // Connect to the official OpenAI Live Sessions API
    // Reference: https://developers.openai.com/api/reference/resources/live/methods/create
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model: model || "gpt-live-1",
          instructions: scenario || "You are a helpful and engaging roleplay conversationalist.",
          audio: {
            output: {
              voice: voice || "alloy",
            },
          },
        },
        transport: {
          type: "webrtc",
          sdp: sdp,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI Live Session creation error:", errorData);
      return NextResponse.json(
        {
          error:
            errorData?.error?.message ||
            `OpenAI Live API error: ${response.status}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Live session creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create live session" },
      { status: 500 }
    );
  }
}
