const mockBatch = {
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

const mockJobData = new Map<string, any>();
const mockDocsMap = new Map<string, any>();

const mockJobRef = (jobId: string) => ({
  get: jest.fn(async () => ({
    exists: mockJobData.has(jobId),
    data: () => mockJobData.get(jobId),
  })),
  set: jest.fn(async (data: any, options?: any) => {
    if (options?.merge && mockJobData.has(jobId)) {
      mockJobData.set(jobId, { ...mockJobData.get(jobId), ...data });
    } else {
      mockJobData.set(jobId, data);
    }
  }),
});

const mockDocRef = (path: string) => ({
  path,
  get: jest.fn(async () => ({
    exists: mockDocsMap.has(path),
    data: () => mockDocsMap.get(path),
  })),
});

const mockQuerySnapshot = (docs: any[]) => ({
  docs,
});

const mockCollectionQueries = new Map<string, any[]>();

const mockDb = {
  collection: jest.fn((collName: string) => {
    if (collName === 'account_deletion_jobs') {
      return {
        doc: (id: string) => mockJobRef(id),
      };
    }
    return {
      doc: (id: string) => mockDocRef(`${collName}/${id}`),
      where: jest.fn((field: string, op: string, val: string) => ({
        get: jest.fn(async () => {
          const key = `${collName}:${field}:${val}`;
          const matches = mockCollectionQueries.get(key) || [];
          return mockQuerySnapshot(
            matches.map((m) => ({
              ref: mockDocRef(`${collName}/${m.id}`),
              data: () => m.data,
            }))
          );
        }),
      })),
    };
  }),
  batch: jest.fn(() => mockBatch),
};

const mockFiles: Array<{ name: string; delete: jest.Mock }> = [];
const mockBucket = {
  getFiles: jest.fn(async () => [mockFiles]),
};
const mockStorage = {
  bucket: jest.fn(() => mockBucket),
};

const mockAuthDeleteUser = jest.fn().mockResolvedValue(undefined);
const mockAuth = {
  deleteUser: mockAuthDeleteUser,
};

jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    details?: any;
    constructor(code: string, message: string, details?: any) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = 'HttpsError';
    }
  }
  return {
    onCall: jest.fn((opts: any, handler: any) => handler || opts),
    HttpsError,
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    serverTimestamp: () => "MOCK_TIMESTAMP",
  },
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: () => mockStorage,
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => mockAuth,
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
}));

import { deleteAccountData } from "../src/index";
import { HttpsError } from "firebase-functions/v2/https";

describe("deleteAccountData Cloud Function", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobData.clear();
    mockDocsMap.clear();
    mockCollectionQueries.clear();
    mockFiles.length = 0;
  });

  it("throws unauthenticated error when called without auth context", async () => {
    const req = { auth: null, data: {} } as any;
    await expect((deleteAccountData as any)(req)).rejects.toThrow(
      new HttpsError("unauthenticated", "User must be authenticated to delete an account.")
    );
  });

  it("deletes all user documents, contributions (including points_of_interest), storage files, and auth account for a standard or suspended user", async () => {
    const uid = "suspended-user-456";
    const req = { auth: { uid }, data: {} } as any;

    // Simulate POI created by suspended user
    mockCollectionQueries.set("points_of_interest:createdByUserId:suspended-user-456", [
      { id: "poi-1", data: { name: "Bench POI", createdByUserId: uid } },
    ]);
    // Simulate charging station created by user
    mockCollectionQueries.set("charging_stations:createdByUserId:suspended-user-456", [
      { id: "station-1", data: { name: "Suspended User Station", createdByUserId: uid } },
    ]);

    const mockFile1 = { name: `users/${uid}/photo.jpg`, delete: jest.fn().mockResolvedValue(undefined) };
    mockFiles.push(mockFile1);

    const result = await (deleteAccountData as any)(req);

    expect(result).toEqual({ success: true, status: "completed", jobId: uid });

    // Verify batch deleted docs
    expect(mockBatch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: "users/suspended-user-456" }));
    expect(mockBatch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: "points_of_interest/poi-1" }));
    expect(mockBatch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: "charging_stations/station-1" }));
    expect(mockBatch.commit).toHaveBeenCalled();

    // Verify storage files deleted
    expect(mockFile1.delete).toHaveBeenCalled();

    // Verify Auth user deleted
    expect(mockAuthDeleteUser).toHaveBeenCalledWith(uid);

    // Verify job status marked as completed
    expect(mockJobData.get(uid)).toEqual(
      expect.objectContaining({
        uid,
        status: "completed",
      })
    );
  });

  it("returns completed status immediately if job is already completed (idempotency)", async () => {
    const uid = "already-deleted-user";
    mockJobData.set(uid, { status: "completed" });

    const req = { auth: { uid }, data: {} } as any;
    const result = await (deleteAccountData as any)(req);

    expect(result).toEqual({ success: true, status: "completed", jobId: uid });
    expect(mockBatch.commit).not.toHaveBeenCalled();
    expect(mockAuthDeleteUser).not.toHaveBeenCalled();
  });

  it("records failed status and throws HttpsError if cleanup step fails", async () => {
    const uid = "error-user-789";
    const req = { auth: { uid }, data: {} } as any;

    mockBatch.commit.mockRejectedValueOnce(new Error("Firestore write error"));

    await expect((deleteAccountData as any)(req)).rejects.toThrow(
      new HttpsError("failed-precondition", "Account cleanup did not complete; retry the deletion.", { jobId: uid })
    );

    expect(mockJobData.get(uid)).toEqual(
      expect.objectContaining({
        uid,
        status: "failed",
        error: "Firestore write error",
      })
    );
  });
});
