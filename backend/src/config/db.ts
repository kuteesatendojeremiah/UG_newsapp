import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  // Node treats an EventEmitter's 'error' event specially — with no listener attached, an
  // error here (a dropped connection, Atlas closing an idle socket, a network blip) throws
  // and crashes the whole process instead of just emitting. Confirmed as the likely cause
  // of a crash-restart loop on Render: local dev never hit this on a stable connection, but
  // Render's networking made it visible immediately.
  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err);
  });

  await mongoose.connect(uri);
}
