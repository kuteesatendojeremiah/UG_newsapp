import mongoose, { Schema, Document } from "mongoose";
import { Category } from "../constants/categories";

export interface UserDocument extends Document {
  device_id: string;
  interests: Category[];

  created_at: Date;
  last_seen: Date; // touched on every request — activity/retention signal
  updated_at: Date; // touched only when interests/profile actually change
}

const UserSchema = new Schema<UserDocument>({
  device_id: { type: String, required: true, unique: true },
  interests: { type: [String], default: [] },

  created_at: { type: Date, default: Date.now },
  last_seen: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.model<UserDocument>("User", UserSchema);
