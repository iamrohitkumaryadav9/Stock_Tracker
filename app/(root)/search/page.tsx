import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { searchGlobal } from '@/lib/actions/discovery.actions';
import SearchResults from '@/components/Search/SearchResults';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Form from 'next/form';

export default async function SearchPage(props: { searchParams: Promise<{ q?: string; type?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect('/sign-in');
    }

    const query = searchParams.q || '';
    const type = (searchParams.type as 'all' | 'stocks' | 'users' | 'posts') || 'all';

    const results = query ? await searchGlobal(query, type) : { stocks: [], users: [], posts: [] };

    return (
        <div className="w-full py-10 px-4 md:px-6 lg:px-8">
            <div className="max-w-screen-xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-100 mb-6">Advanced Search</h1>

                {/* Search Bar */}
                <Form action="/search" className="flex gap-2 mb-8">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            name="q"
                            defaultValue={query}
                            placeholder="Search stocks, people, or posts..."
                            className="pl-10 bg-gray-800 border-gray-700 text-white"
                        />
                    </div>
                    <input type="hidden" name="type" value={type} />
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Search</Button>
                </Form>

                {/* Tabs */}
                <div className="mb-6">
                    {/* Using links for tabs to preserve query params and allow server-side rendering */}
                    <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg w-fit">
                        {['all', 'stocks', 'users', 'posts'].map((t) => (
                            <a
                                key={t}
                                href={`/search?q=${query}&type=${t}`}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${type === t
                                        ? 'bg-gray-700 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Results */}
                {query ? (
                    <SearchResults results={results} type={type} />
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        Enter a search term to find stocks, users, and community posts.
                    </div>
                )}
            </div>
        </div>
    );
}
