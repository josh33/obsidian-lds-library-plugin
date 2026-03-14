import { AvailableLanguage } from "@/lang";
import { bookData } from "@/utils/config";
import { fetchScripture } from "@/utils/scripture";

type VerseInsertStyle = "blockquote" | "callout";

export class VerseSuggestion {
    // defining variables in the class.
    public text: string;
    public previewText: string;
    private bookTitleInLanguage: string;
    private verseIds: string;
    private url: string;
    private vaultBookTitle: string;
    private verses: { verse: number; text: string }[] = [];

    private constructor(
        public book: string,
        public chapter: number,
        public verseString: string,
        public lang: AvailableLanguage,
        public style: VerseInsertStyle,
    ) {
        this.verseIds = verseString
            .split(",")
            .map((range) =>
                range
                    .split("-")
                    .map((verse) => `p${verse}`)
                    .join("-"),
            )
            .join(",");
    }

    // factory function
    static async create(
        book: string,
        chapter: number,
        verseString: string,
        lang: AvailableLanguage,
        style: VerseInsertStyle,
    ) {
        const suggestion = new VerseSuggestion(
            book,
            chapter,
            verseString,
            lang,
            style,
        );

        await suggestion.loadVerse();
        return suggestion;
    }

    private getInternalLink(): string {
        const firstRange = this.verseString.split(",")[0]?.trim() ?? "";
        const firstVerse = firstRange.split("-")[0]?.trim() ?? "";
        const displayRange = this.verseString;

        return `[[${this.bookTitleInLanguage} ${this.chapter}#${firstVerse}|${this.bookTitleInLanguage}:${displayRange}]]`;
    }

    public getReplacement(): string {
        if (this.style === "callout") {
            return [
                `> [!ldslib] ${this.getInternalLink()}`,
                this.text,
                "",
            ].join("\n");
        }

        return [
            ...this.verses.map(
                ({ verse, text }) =>
                    `> ${this.bookTitleInLanguage} ${this.chapter}:${verse} ${text}`,
            ),
            "",
        ].join("\n");
    }

    private getUrl(volumeTitleShort: string, bookTitleShort: string): string {
        return `https://www.churchofjesuschrist.org/study/scriptures/${volumeTitleShort}/${bookTitleShort}/${this.chapter}?lang=${this.lang}&id=${this.verseIds}`;
    }

    private getVaultLink(verse: number): string {
        return `[[${this.vaultBookTitle} ${this.chapter}#${verse}]]`;
    }

    private getSelectedVerses(): number[] {
        return this.verseString
            .split(",")
            .flatMap((segment) => {
                const [startRaw, endRaw] = segment.split("-");
                const start = Number(startRaw.trim());
                const end = Number((endRaw ?? startRaw).trim());

                if (Number.isNaN(start) || Number.isNaN(end)) {
                    return [];
                }

                const [min, max] = start <= end ? [start, end] : [end, start];

                return Array.from(
                    { length: max - min + 1 },
                    (_, index) => min + index,
                );
            });
    }

    private normalizeBookInput(bookTitle: string): string {
        return bookTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    private getShortenedName(bookTitle: string) {
        const normalizedBookTitle = this.normalizeBookInput(bookTitle);

        for (const [name, info] of Object.entries(bookData)) {
            if (
                info.names.some(
                    (alias) =>
                        this.normalizeBookInput(alias) === normalizedBookTitle,
                )
            ) {
                const volume = info.volume;
                return [name, volume, info.names[0]];
            }
        }
        return ["", "", ""];
    }

    private async loadVerse(): Promise<void> {
        const [bookTitleShort, volumeTitleShort, vaultBookTitle] =
            this.getShortenedName(this.book);

        if (bookTitleShort === "" || volumeTitleShort === "")
            throw new Error(`Couldn't find book name ${this.book}`);

        this.url = this.getUrl(volumeTitleShort, bookTitleShort);
        this.vaultBookTitle = vaultBookTitle;

        const scriptureData = await fetchScripture(this.url);
        this.bookTitleInLanguage =
            bookTitleShort === "dc"
                ? "Doctrine & Covenants"
                : scriptureData.nativeBookTitle;
        this.verses = scriptureData.verses.map((_verse) => {
            const [_, verseNumber, text] = _verse.match(/^(\d+)\s*(.*)$/) ?? [
                null,
                "0",
                "",
            ];
            const verse = Number(verseNumber);

            return {
                volumeTitleShort,
                bookTitleShort,
                chapter: this.chapter,
                verse,
                text,
            };
        });

        this.text = this.verses.map(({ verse, text }) => `> ${verse} ${text}`).join("\n");

        this.previewText = this.verses
            .map(({ verse, text }) => `${verse} ${text}`)
            .join("\n");
    }

    public render(el: HTMLElement): void {
        const outer = el.createDiv({ cls: "obr-suggester-container" });
        outer.createDiv({ cls: "obr-shortcode" }).setText(this.previewText);
    }
}
