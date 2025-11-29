import ROICalculator from '@/components/tools/ROICalculator';

export default function ROIPage() {
    return (
        <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-6 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold mb-8 text-center">Investment Tools</h1>
                <ROICalculator />
            </div>
        </div>
    );
}
