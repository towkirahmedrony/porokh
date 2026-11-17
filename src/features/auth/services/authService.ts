import { supabase } from '@/shared/lib/supabase';
import { Database } from '@/shared/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export const authService = {
  // Supabase থেকে সরাসরি প্রোফাইল আনবে
  async getUserProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  // user_roles এবং permissions টেবিল থেকে সরাসরি ডেটা আনবে
  async getRoleAndPermissions(): Promise<{ role: string; permissions: string[] }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
         return { role: 'student', permissions: [] };
      }

      // ১. user_roles টেবিল থেকে ইউজারের রোল নিয়ে আসা
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const userRole = roleData?.role || 'student';

      // ২. role_permissions টেবিল থেকে ওই রোলের সব পারমিশন নিয়ে আসা (Foreign Key Join)
      const { data: permData, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permissions (
            action
          )
        `)
        .eq('role', userRole);

      let permissions: string[] = [];
      
      if (permData && !permError) {
        // Safe mapping to handle both array and object returns from Supabase joins
        permissions = permData.flatMap((item: any) => {
          const perms = item.permissions;
          if (!perms) return [];
          if (Array.isArray(perms)) return perms.map((p: any) => p.action);
          return [perms.action];
        }).filter((action: string | undefined): action is string => Boolean(action));
      }

      return { 
        role: userRole, 
        permissions 
      };
      
    } catch (error) {
      console.error('Error fetching role/permissions from Supabase:', error);
      return { role: 'student', permissions: [] };
    }
  },

  // পাসওয়ার্ড রিসেট লজিক
  async resetPassword(identifier: string, redirectTo: string): Promise<void> {
    let targetEmail = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail);

    // যদি ইমেইল না হয়ে ইউজারনেম হয়, তাহলে ডাটাবেস থেকে ইমেইল বের করা
    if (!isEmail) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', targetEmail)
        .maybeSingle();

      if (profileError || !data?.email) {
        throw new Error('এই ইউজারনেম দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
      }
      targetEmail = data.email;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo,
    });

    if (resetError) {
      throw new Error('পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে। সঠিক তথ্য দিন।');
    }
  }
};
