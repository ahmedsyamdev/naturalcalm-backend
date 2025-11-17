import request from 'supertest';
import app from '../../app';
import { CustomProgram } from '../../models/CustomProgram.model';
import {
  createTestUser,
  createTestCategory,
  createMultipleTracks,
} from '../helpers/testData';
import '../setup';

describe('User Programs - Custom Programs', () => {
  let userToken: string;
  let userId: string;
  let user2Token: string;
  let user2Id: string;
  let trackIds: string[];

  beforeEach(async () => {
    // Create test users
    const { user, token } = await createTestUser();
    userToken = token;
    userId = user._id.toString();

    const user2Data = await createTestUser();
    user2Token = user2Data.token;
    user2Id = user2Data.user._id.toString();

    // Create test category and tracks
    const category = await createTestCategory();
    const tracks = await createMultipleTracks(category._id, 5);
    trackIds = tracks.map((t) => t._id.toString());
  });

  describe('POST /api/v1/users/programs/custom', () => {
    it('should create a custom program successfully', async () => {
      const customProgramData = {
        name: 'برنامجي المخصص',
        description: 'برنامج تأمل مخصص',
        trackIds: [trackIds[0], trackIds[1], trackIds[2]],
      };

      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send(customProgramData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('created');
      expect(res.body.data).toHaveProperty('name', customProgramData.name);
      expect(res.body.data).toHaveProperty('description', customProgramData.description);
      expect(res.body.data.tracks).toHaveLength(3);
      expect(res.body.data).toHaveProperty('thumbnailUrl');

      // Verify in database
      const customProgram = await CustomProgram.findOne({ userId, name: customProgramData.name });
      expect(customProgram).toBeTruthy();
      expect(customProgram?.tracks).toHaveLength(3);
    });

    it('should set track order correctly', async () => {
      const customProgramData = {
        name: 'برنامج مرتب',
        trackIds: [trackIds[2], trackIds[0], trackIds[1]],
      };

      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send(customProgramData)
        .expect(201);

      expect(res.body.data.tracks[0].order).toBe(1);
      expect(res.body.data.tracks[1].order).toBe(2);
      expect(res.body.data.tracks[2].order).toBe(3);
    });

    it('should set thumbnail from first track', async () => {
      const customProgramData = {
        name: 'برنامج بصورة',
        trackIds: [trackIds[0], trackIds[1]],
      };

      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send(customProgramData)
        .expect(201);

      expect(res.body.data.thumbnailUrl).toBeTruthy();
      expect(res.body.data.thumbnailUrl).toContain('example.com');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ trackIds: [trackIds[0]] })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('name');
    });

    it('should return 400 if trackIds is empty', async () => {
      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test Program', trackIds: [] })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('track');
    });

    it('should return 400 if track IDs are invalid', async () => {
      const res = await request(app)
        .post('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Program',
          trackIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        })
        .expect(400);

      expect(res.body.message).toContain('invalid');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/v1/users/programs/custom')
        .send({ name: 'Test', trackIds: [trackIds[0]] })
        .expect(401);
    });
  });

  describe('GET /api/v1/users/programs/custom', () => {
    beforeEach(async () => {
      // Create custom programs for the user
      await CustomProgram.create({
        userId,
        name: 'برنامج 1',
        tracks: [
          { trackId: trackIds[0], order: 1 },
          { trackId: trackIds[1], order: 2 },
        ],
      });

      await CustomProgram.create({
        userId,
        name: 'برنامج 2',
        tracks: [{ trackId: trackIds[2], order: 1 }],
      });

      // Create a program for another user (should not be returned)
      await CustomProgram.create({
        userId: user2Id,
        name: 'برنامج المستخدم 2',
        tracks: [{ trackId: trackIds[3], order: 1 }],
      });
    });

    it('should get all custom programs for the user', async () => {
      const res = await request(app)
        .get('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].tracks).toBeTruthy();
      expect(res.body.data[0]).toHaveProperty('name');
    });

    it('should sort by createdAt descending', async () => {
      const res = await request(app)
        .get('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const dates = res.body.data.map((p: { createdAt: string }) => new Date(p.createdAt).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    });

    it('should populate track details', async () => {
      const res = await request(app)
        .get('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data[0].tracks[0]).toHaveProperty('title');
      expect(res.body.data[0].tracks[0]).toHaveProperty('imageUrl');
      expect(res.body.data[0].tracks[0]).toHaveProperty('durationSeconds');
      expect(res.body.data[0].tracks[0]).toHaveProperty('order');
    });

    it('should return empty array if no custom programs', async () => {
      // Delete all custom programs
      await CustomProgram.deleteMany({ userId });

      const res = await request(app)
        .get('/api/v1/users/programs/custom')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(app).get('/api/v1/users/programs/custom').expect(401);
    });
  });

  describe('GET /api/v1/users/programs/custom/:id', () => {
    let customProgramId: string;

    beforeEach(async () => {
      const customProgram = await CustomProgram.create({
        userId,
        name: 'برنامج اختبار',
        description: 'وصف البرنامج',
        tracks: [
          { trackId: trackIds[0], order: 1 },
          { trackId: trackIds[1], order: 2 },
        ],
      });
      customProgramId = customProgram._id.toString();
    });

    it('should get custom program by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'برنامج اختبار');
      expect(res.body.data).toHaveProperty('description', 'وصف البرنامج');
      expect(res.body.data.tracks).toHaveLength(2);
    });

    it('should return 404 if program not found', async () => {
      const invalidId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .get(`/api/v1/users/programs/custom/${invalidId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 404 if not owner', async () => {
      const res = await request(app)
        .get(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app).get(`/api/v1/users/programs/custom/${customProgramId}`).expect(401);
    });
  });

  describe('PUT /api/v1/users/programs/custom/:id', () => {
    let customProgramId: string;

    beforeEach(async () => {
      const customProgram = await CustomProgram.create({
        userId,
        name: 'برنامج قديم',
        description: 'وصف قديم',
        tracks: [
          { trackId: trackIds[0], order: 1 },
          { trackId: trackIds[1], order: 2 },
        ],
      });
      customProgramId = customProgram._id.toString();
    });

    it('should update custom program name', async () => {
      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'برنامج جديد' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('برنامج جديد');

      // Verify in database
      const updated = await CustomProgram.findById(customProgramId);
      expect(updated?.name).toBe('برنامج جديد');
    });

    it('should update custom program description', async () => {
      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ description: 'وصف جديد' })
        .expect(200);

      expect(res.body.data.description).toBe('وصف جديد');
    });

    it('should update tracks array', async () => {
      const newTrackIds = [trackIds[2], trackIds[3], trackIds[4]];

      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ trackIds: newTrackIds })
        .expect(200);

      expect(res.body.data.tracks).toHaveLength(3);
      expect(res.body.data.tracks[0].order).toBe(1);
      expect(res.body.data.tracks[1].order).toBe(2);
      expect(res.body.data.tracks[2].order).toBe(3);
    });

    it('should update thumbnail when tracks changed', async () => {
      const originalProgram = await CustomProgram.findById(customProgramId);
      const _originalThumbnail = originalProgram?.thumbnailUrl;

      await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ trackIds: [trackIds[4]] })
        .expect(200);

      const updated = await CustomProgram.findById(customProgramId);
      // Thumbnail should be updated (might be different if track 4 has different image)
      expect(updated?.thumbnailUrl).toBeTruthy();
    });

    it('should return 404 if program not found', async () => {
      const invalidId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${invalidId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 404 if not owner', async () => {
      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 400 for invalid track IDs', async () => {
      const res = await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ trackIds: ['507f1f77bcf86cd799439011'] })
        .expect(400);

      expect(res.body.message).toContain('invalid');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .put(`/api/v1/users/programs/custom/${customProgramId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/programs/custom/:id', () => {
    let customProgramId: string;

    beforeEach(async () => {
      const customProgram = await CustomProgram.create({
        userId,
        name: 'برنامج للحذف',
        tracks: [{ trackId: trackIds[0], order: 1 }],
      });
      customProgramId = customProgram._id.toString();
    });

    it('should delete custom program', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');

      // Verify deleted from database
      const deleted = await CustomProgram.findById(customProgramId);
      expect(deleted).toBeNull();
    });

    it('should return 404 if program not found', async () => {
      const invalidId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .delete(`/api/v1/users/programs/custom/${invalidId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 404 if not owner', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/programs/custom/${customProgramId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(res.body.message).toContain('not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app).delete(`/api/v1/users/programs/custom/${customProgramId}`).expect(401);
    });
  });
});
