// Tiny helpers so every API route responds in the same shape.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Runs a controller and converts thrown errors into friendly JSON. */
export async function handle(fn) {
  try {
    return json(await fn());
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    return json(
      { error: error?.message || "Something went wrong while loading FPL data." },
      status,
    );
  }
}
