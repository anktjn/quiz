import { supabase } from './supabase';

const ENABLE_BOOK_COVERS = true; // Feature flag for easy disable

export async function fetchBookCover(bookTitle) {
  // Return null if feature is disabled
  if (!ENABLE_BOOK_COVERS) return null;

  // Clean the title by removing file extension and common words
  const cleanTitle = bookTitle
    .replace('.pdf', '')
    .replace(/_/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .trim();

  try {
    // Try Google Books API first
    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanTitle)}&maxResults=1`
    );
    const googleData = await googleResponse.json();

    if (googleData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail) {
      return googleData.items[0].volumeInfo.imageLinks.thumbnail
        .replace('http://', 'https://')
        .replace('&zoom=1', '');
    }

    // Fallback to Open Library API
    const openLibraryResponse = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanTitle)}&limit=1`
    );
    const openLibraryData = await openLibraryResponse.json();

    if (openLibraryData.docs?.[0]?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${openLibraryData.docs[0].cover_i}-L.jpg`;
    }

    // Return null if no cover is found - we'll use initials in the component
    return null;
  } catch (error) {
    console.error('Error fetching book cover:', error);
    return null;
  }
}

// Update cover URL for a specific PDF
export async function updatePDFCover(pdfId, pdfName) {
  try {
    // Get book cover URL
    const coverUrl = await fetchBookCover(pdfName);
    
    if (!coverUrl) {
      return { success: false, error: 'No cover found' };
    }
    
    // Update PDF record with new cover URL
    const { error } = await supabase
      .from('pdfs')
      .update({ cover_url: coverUrl })
      .eq('id', pdfId);
      
    if (error) throw error;
    
    return { success: true, coverUrl };
  } catch (error) {
    console.error('Error updating PDF cover:', error);
    return { success: false, error };
  }
}

// Utility function to revert all book covers
export async function revertBookCovers() {
  try {
    const { error } = await supabase
      .from('pdfs')
      .update({ cover_url: null })
      .not('cover_url', 'is', null);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error reverting book covers:', error);
    return { success: false, error };
  }
} 