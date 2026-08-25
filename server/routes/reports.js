import express from 'express';
import pool from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET all reports for the authenticated user (metadata list sorted newest first)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, original_filename, status, created_at 
       FROM reports 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Fetch reports error:', err);
    return res.status(500).json({ error: 'Failed to retrieve report history.' });
  }
});

// GET single report details (full stored analysis_data)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, user_id, original_filename, status, analysis_data, created_at 
       FROM reports 
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = result.rows[0];
    return res.json({
      id: report.id,
      original_filename: report.original_filename,
      status: report.status,
      created_at: report.created_at,
      analysis_data: report.analysis_data
    });
  } catch (err) {
    console.error('Fetch single report error:', err);
    return res.status(500).json({ error: 'Failed to retrieve report.' });
  }
});

// DELETE a report owned by the authenticated user
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM reports 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or permission denied.' });
    }

    return res.json({ message: 'Report deleted successfully.', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete report error:', err);
    return res.status(500).json({ error: 'Failed to delete report.' });
  }
});

export default router;
