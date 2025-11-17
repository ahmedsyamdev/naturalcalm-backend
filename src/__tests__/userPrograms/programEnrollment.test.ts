import request from 'supertest';
import app from '../../app';
import { UserProgram } from '../../models/UserProgram.model';
import { Notification } from '../../models/Notification.model';
import {
  createTestUser,
  createTestCategory,
  createTestProgram,
  createMultipleTracks,
} from '../helpers/testData';
import '../setup';

describe('User Programs - Program Enrollment', () => {
  let userToken: string;
  let userId: string;
  let programId: string;
  let trackIds: string[];

  beforeEach(async () => {
    // Create test user
    const { user, token } = await createTestUser();
    userToken = token;
    userId = user._id.toString();

    // Create test category
    const category = await createTestCategory();

    // Create test tracks
    const tracks = await createMultipleTracks(category._id, 3);
    trackIds = tracks.map((t) => t._id.toString());

    // Create test program
    const program = await createTestProgram(category._id, tracks.map((t) => t._id));
    programId = program._id.toString();
  });

  describe('POST /api/v1/users/programs/:programId/enroll', () => {
    it('should enroll user in a program successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/users/programs/${programId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('enrolled');
      expect(res.body.data).toHaveProperty('userId');
      expect(res.body.data).toHaveProperty('programId');
      expect(res.body.data.progress).toBe(0);
      expect(res.body.data.completedTracks).toEqual([]);

      // Verify in database
      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment).toBeTruthy();
      expect(enrollment?.progress).toBe(0);
    });

    it('should prevent duplicate enrollment', async () => {
      // First enrollment
      await request(app)
        .post(`/api/v1/users/programs/${programId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      // Duplicate enrollment
      const res = await request(app)
        .post(`/api/v1/users/programs/${programId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toContain('Already enrolled');

      // Verify only one enrollment exists
      const enrollments = await UserProgram.find({ userId, programId });
      expect(enrollments.length).toBe(1);
    });

    it('should return 404 for invalid program ID', async () => {
      const invalidId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post(`/api/v1/users/programs/${invalidId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/v1/users/programs/${programId}/enroll`)
        .expect(401);
    });

    it('should return 400 for invalid program ID format', async () => {
      await request(app)
        .post('/api/v1/users/programs/invalid-id/enroll')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/users/programs', () => {
    beforeEach(async () => {
      // Enroll in the program
      await UserProgram.create({
        userId,
        programId,
        completedTracks: [],
        progress: 0,
      });
    });

    it('should get all enrolled programs', async () => {
      const res = await request(app)
        .get('/api/v1/users/programs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toHaveProperty('programDetails');
      expect(res.body.data[0]).toHaveProperty('completedTracksCount');
      expect(res.body.data[0]).toHaveProperty('totalTracksCount');
      expect(res.body.data[0].totalTracksCount).toBe(3);
    });

    it('should return empty array when no enrollments', async () => {
      // Delete the enrollment
      await UserProgram.deleteOne({ userId, programId });

      const res = await request(app)
        .get('/api/v1/users/programs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should sort by lastAccessedAt descending', async () => {
      // Create another program and enroll
      const tracks2 = await createMultipleTracks((await createTestCategory())._id, 2);
      const program2 = await createTestProgram(
        (await createTestCategory())._id,
        tracks2.map((t) => t._id)
      );

      await UserProgram.create({
        userId,
        programId: program2._id,
        completedTracks: [],
        progress: 0,
        lastAccessedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/users/programs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      // First one should have lastAccessedAt (most recent)
      expect(res.body.data[0].lastAccessedAt).toBeTruthy();
    });

    it('should return 401 without authentication', async () => {
      await request(app).get('/api/v1/users/programs').expect(401);
    });
  });

  describe('GET /api/v1/users/programs/:programId/progress', () => {
    beforeEach(async () => {
      // Enroll in the program with some progress
      await UserProgram.create({
        userId,
        programId,
        completedTracks: [trackIds[0]],
        progress: 33,
      });
    });

    it('should get program progress', async () => {
      const res = await request(app)
        .get(`/api/v1/users/programs/${programId}/progress`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('completedTracks');
      expect(res.body.data).toHaveProperty('progress');
      expect(res.body.data).toHaveProperty('enrolledAt');
      expect(res.body.data).toHaveProperty('isCompleted');
      expect(res.body.data.completedTracksCount).toBe(1);
      expect(res.body.data.totalTracksCount).toBe(3);
    });

    it('should return 404 if not enrolled', async () => {
      // Delete enrollment
      await UserProgram.deleteOne({ userId, programId });

      const res = await request(app)
        .get(`/api/v1/users/programs/${programId}/progress`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toContain('Not enrolled');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/v1/users/programs/${programId}/progress`)
        .expect(401);
    });
  });

  describe('POST /api/v1/users/programs/:programId/tracks/:trackId/complete', () => {
    beforeEach(async () => {
      // Enroll in the program
      await UserProgram.create({
        userId,
        programId,
        completedTracks: [],
        progress: 0,
      });
    });

    it('should mark track as complete', async () => {
      const trackId = trackIds[0];

      const res = await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('completedTracks');
      expect(res.body.data.completedTracks).toContain(trackId);
      expect(res.body.data.progress).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('lastAccessedAt');

      // Verify in database
      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment?.completedTracks.map((id) => id.toString())).toContain(trackId);
    });

    it('should update progress correctly', async () => {
      // Complete first track (should be ~33%)
      await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackIds[0]}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment?.progress).toBeCloseTo(33, 0);
    });

    it('should not add duplicate completed tracks', async () => {
      const trackId = trackIds[0];

      // Mark as complete twice
      await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment?.completedTracks.length).toBe(1);
    });

    it('should detect program completion and send notification', async () => {
      // Complete all tracks
      for (const trackId of trackIds) {
        await request(app)
          .post(`/api/v1/users/programs/${programId}/tracks/${trackId}/complete`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);
      }

      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment?.isCompleted).toBe(true);
      expect(enrollment?.completedAt).toBeTruthy();
      expect(enrollment?.progress).toBe(100);

      // Check notification was created
      const notification = await Notification.findOne({
        userId,
        type: 'achievement',
      });
      expect(notification).toBeTruthy();
      expect(notification?.title).toContain('أكملت');
    });

    it('should return 404 if not enrolled', async () => {
      await UserProgram.deleteOne({ userId, programId });

      const res = await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackIds[0]}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toContain('Not enrolled');
    });

    it('should return 400 if track not part of program', async () => {
      // Create a track not in the program
      const category = await createTestCategory();
      const extraTrack = await createMultipleTracks(category._id, 1);
      const extraTrackId = extraTrack[0]._id.toString();

      const res = await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${extraTrackId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toContain('not part of this program');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/v1/users/programs/${programId}/tracks/${trackIds[0]}/complete`)
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/programs/:programId/enroll', () => {
    beforeEach(async () => {
      // Enroll in the program
      await UserProgram.create({
        userId,
        programId,
        completedTracks: [],
        progress: 0,
      });
    });

    it('should unenroll from program', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/programs/${programId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('unenrolled');

      // Verify enrollment deleted
      const enrollment = await UserProgram.findOne({ userId, programId });
      expect(enrollment).toBeNull();
    });

    it('should return 404 if not enrolled', async () => {
      await UserProgram.deleteOne({ userId, programId });

      const res = await request(app)
        .delete(`/api/v1/users/programs/${programId}/enroll`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete(`/api/v1/users/programs/${programId}/enroll`)
        .expect(401);
    });
  });
});
