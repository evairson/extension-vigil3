export class ReasonedAnalysis {
    analysis: Analysis[];

    constructor() {
        this.analysis = [];
    }
}

export class Analysis {
    vulnerability: any;
    reasoning: string;

    constructor(vulnerability: any, reasoning: string) {
        this.vulnerability = vulnerability;
        this.reasoning = reasoning;
    }
}