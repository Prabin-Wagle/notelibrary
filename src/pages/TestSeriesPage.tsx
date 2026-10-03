import TestSeriesCollectionList from '../components/TestSeries/TestSeriesCollectionList';

const TestSeriesPage = () => {
    return (
        <div className="anim-fade">
            <header className="page-header">
                <div>
                    <p className="page-kicker">Practice with purpose</p>
                    <h1 className="page-title">Test series</h1>
                    <p className="page-description">Choose a collection, practise under real exam conditions, and use every result to decide what to study next.</p>
                </div>
                <div className="hidden rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 text-right sm:block dark:border-brand-500/20 dark:bg-brand-500/[.07]">
                    <p className="font-metric text-lg font-bold text-brand-800 dark:text-brand-300">01</p>
                    <p className="text-[.6rem] font-bold uppercase tracking-[.14em] text-brand-700/70 dark:text-brand-300/70">collection at a time</p>
                </div>
            </header>
            <TestSeriesCollectionList />
        </div>
    );
};

export default TestSeriesPage;
