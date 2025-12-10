import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Update run status to training
  const { error } = await supabase
    .from("runs")
    .update({ status: "training" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // In production, this would trigger the actual training job
  // For local development, the training script watches for status changes
  // or is triggered manually

  return NextResponse.json({
    success: true,
    message: "Training started",
    run_id: id,
    instructions: {
      local: `cd training && python train.py --run-id ${id} --use-dummy-data`,
      docker: `docker-compose -f simulation/docker-compose.yml up`,
    },
  });
}
