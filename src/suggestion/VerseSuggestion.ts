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

    public getReplacement(): string {
        if (this.style === "callout") {
            const range = this.verseString.replaceAll(",", ", ");

            return [
                `> [!ldslib] [${this.bookTitleInLanguage}:${range}](${this.url})`,
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
                return [name, volume];
            }
        }
        return ["", ""];
    }

    private async loadVerse(): Promise<void> {
        const [bookTitleShort, volumeTitleShort] = this.getShortenedName(
            this.book,
        );

        if (bookTitleShort === "" || volumeTitleShort === "")
            throw new Error(`Couldn't find book name ${this.book}`);

        this.url = this.getUrl(volumeTitleShort, bookTitleShort);

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
