import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { AccountStatus, UserRole } from "@medshift/shared-types";

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: "users", timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ enum: AccountStatus, default: AccountStatus.Pending })
  status!: AccountStatus;
}

export const UserSchema = SchemaFactory.createForClass(User);
