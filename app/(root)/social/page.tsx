import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPosts } from '@/lib/actions/social.actions';
import PostFeed from '@/components/Social/PostFeed';
import CreatePost from '@/components/Social/CreatePost';

export default async function SocialPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const initialPosts = await getPosts(undefined, 50);
  const currentUserId = session.user.id;

  return (
    <div className="w-full py-10 px-4 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Community Feed</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PostFeed initialPosts={initialPosts} currentUserId={currentUserId} />
          </div>
          
          <div>
            <CreatePost />
          </div>
        </div>
      </div>
    </div>
  );
}

