/**
 * Edge Function to handle photo uploads to Supabase Storage
 * 
 * Upload flow:
 * 1. Offline photo capture
 * 2. Local storage
 * 3. When online, call this Edge Function
 * 4. Edge Function uploads to Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // Replace with your actual service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Storage bucket configuration
const BUCKET_NAME = 'production-photos';

export default async function handler(request, response) {
  try {
    // Check if request is multipart/form-data
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return response.status(400).json({
        success: false,
        error: 'Request must be multipart/form-data'
      });
    }

    // Parse form data
    const formData = await request.formData();
    const image = formData.get('image');
    const path = formData.get('path');

    // Validate required fields
    if (!image) {
      return response.status(400).json({
        success: false,
        error: 'Image is required'
      });
    }

    if (!path) {
      return response.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    // Check file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (image.size > MAX_FILE_SIZE) {
      return response.status(400).json({
        success: false,
        error: 'Image too large. Maximum size is 5MB'
      });
    }

    // Check file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!ALLOWED_TYPES.includes(image.type)) {
      return response.status(400).json({
        success: false,
        error: 'Invalid file type. Only JPG and PNG are allowed'
      });
    }

    // Convert image to buffer
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        contentType: image.type,
        upsert: true // Overwrite existing file with the same name
      });

    if (error) {
      console.error('Storage upload error:', error);
      return response.status(500).json({
        success: false,
        error: 'Failed to upload image to storage'
      });
    }

    // Return success response
    return response.status(200).json({
      success: true,
      data: {
        path: data.path,
        url: `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${data.path}`
      }
    });
  } catch (error) {
    console.error('Edge Function error:', error);
    return response.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
