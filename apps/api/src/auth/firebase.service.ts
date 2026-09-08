import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const projectId = this.configService.get<string>("firebase.projectId");
    const privateKey = this.configService.get<string>("firebase.privateKey");
    const clientEmail = this.configService.get<string>("firebase.clientEmail");
    const useAdc = this.configService.get<string>("firebase.useApplicationDefaultCredentials");

    try {
      if (admin.apps.length === 0) {
        // Option 1: Use explicit service account credentials
        if (projectId && privateKey && clientEmail) {
          this.app = admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              privateKey,
              clientEmail,
            }),
          });
          this.logger.log("Firebase Admin SDK initialized with service account");
        }
        // Option 2: Use Application Default Credentials (gcloud auth)
        else if (useAdc === "true" && projectId) {
          this.app = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId,
          });
          this.logger.log("Firebase Admin SDK initialized with Application Default Credentials");
        }
        // Option 3: No Firebase
        else {
          this.logger.warn("Firebase credentials not configured - Firebase auth will be disabled");
          return;
        }
      } else {
        this.app = admin.apps[0]!;
      }
    } catch (error) {
      this.logger.error("Failed to initialize Firebase Admin SDK", error);
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.error("Failed to verify Firebase ID token", error);
      return null;
    }
  }

  async createUser(email: string, password: string, displayName?: string): Promise<admin.auth.UserRecord> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    return admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
  }

  async getUserByUid(uid: string): Promise<admin.auth.UserRecord | null> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    try {
      return await admin.auth().getUser(uid);
    } catch {
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    try {
      return await admin.auth().getUserByEmail(email);
    } catch {
      return null;
    }
  }

  async updatePassword(uid: string, newPassword: string): Promise<admin.auth.UserRecord> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    return admin.auth().updateUser(uid, { password: newPassword });
  }

  async deleteUser(uid: string): Promise<void> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    await admin.auth().deleteUser(uid);
  }

  async setCustomClaims(uid: string, claims: Record<string, any>): Promise<void> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    await admin.auth().setCustomUserClaims(uid, claims);
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    if (!this.app) {
      throw new Error("Firebase not initialized");
    }

    await admin.auth().revokeRefreshTokens(uid);
  }

  isInitialized(): boolean {
    return this.app !== null;
  }
}
