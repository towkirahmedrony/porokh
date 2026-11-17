import { supabase } from '@/shared/lib/supabase';
import { Database } from '@/shared/types/supabase';

// Helper types for local usage if full DB types aren't fully inferred automatically
type Chapter = Database['public']['Tables']['chapters']['Row'];

export const contentService = {
  /**
   * Fetch all available subjects
   */
  async getSubjects() {
    const { data, error } = await (supabase.from('subjects') as any)
      // 'name:name_bn' অ্যালিয়াস ব্যবহার করে বাংলা নাম আনা হচ্ছে এবং ফ্রন্টএন্ডে 'name' হিসেবে পাঠানো হচ্ছে
      .select('id, name:name_bn, icon_url, description, sequence')
      // সর্টিংয়ের জন্য আপনার স্কিমার 'sequence' কলামটি ব্যবহার করা হচ্ছে
      .order('sequence', { ascending: true }); 

    if (error) throw error;
    return data;
  },

  /**
   * Fetch chapters for a specific subject
   */
  async getChapters(subjectId: string) {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      // চ্যাপ্টার টেবিলেও সর্টিংয়ের জন্য আপনার স্কিমার 'sequence' কলামটি ব্যবহার করা হচ্ছে
      .order('sequence', { ascending: true }); 

    if (error) throw error;
    return data as Chapter[];
  },

  /**
   * Get metadata for a specific chapter (useful for breadcrumbs)
   */
  async getChapterDetails(chapterId: string) {
    const { data, error } = await (supabase.from('chapters') as any)
      // অ্যালিয়াস করে 'subjects' টেবিল থেকে 'name_bn' আনা হচ্ছে
      .select('*, subjects(name:name_bn)') 
      .eq('id', chapterId)
      .single();
    
    if (error) throw error;
    return data;
  }
};
