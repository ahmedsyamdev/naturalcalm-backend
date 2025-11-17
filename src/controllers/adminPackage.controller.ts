import { Request, Response } from 'express';
import { Package } from '../models/Package.model';
import logger from '../utils/logger';
import { cacheDel } from '../config/redis';

/**
 * Get all packages (admin)
 * GET /api/v1/admin/packages
 */
export const getAllPackages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { isActive } = req.query;

    const query: Record<string, unknown> = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const packages = await Package.find(query).sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    logger.error('Get all packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages',
    });
  }
};

/**
 * Get package by ID (admin)
 * GET /api/v1/admin/packages/:id
 */
export const getPackageById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const pkg = await Package.findById(id);

    if (!pkg) {
      res.status(404).json({
        success: false,
        message: 'Package not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    logger.error('Get package by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch package',
    });
  }
};

/**
 * Update package (admin)
 * PUT /api/v1/admin/packages/:id
 */
export const updatePackage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fields that can be updated
    const allowedFields = [
      'name',
      'price',
      'discount',
      'durationInDays',
      'features',
      'isActive',
      'displayOrder',
    ];

    // Filter update data to only allowed fields
    const filteredData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
      return;
    }

    // Validate price if provided
    if (filteredData.price !== undefined && typeof filteredData.price === 'number') {
      if (filteredData.price < 0) {
        res.status(400).json({
          success: false,
          message: 'Price must be greater than or equal to 0',
        });
        return;
      }
    }

    // Update package
    const pkg = await Package.findByIdAndUpdate(
      id,
      { $set: filteredData },
      { new: true, runValidators: true }
    );

    if (!pkg) {
      res.status(404).json({
        success: false,
        message: 'Package not found',
      });
      return;
    }

    // Clear cache
    await cacheDel('subscription:packages:active');

    logger.info(`Admin ${req.user?.id} updated package ${pkg.name}`);

    res.status(200).json({
      success: true,
      data: pkg,
      message: 'Package updated successfully',
    });
  } catch (error) {
    logger.error('Update package error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update package',
    });
  }
};
