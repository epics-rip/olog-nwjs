import NG = require("nodegit");
import fs = require("fs");

/**
 * Class for writing/reading data from the git repo
 */
class StorageDir {

    //name of folder containing the repository remote
    private _folderName : string = 'ologDir';

    //Configurations for git
    private _pathName : string = '';
    private _remoteURL : string = '';
    private _remoteName : string = 'origin';

    //Repository object
    private _repo : any;

    //Remote object
    private _remote : any;

    private _user : any;

    private _index : any;

    private _oid : any;

    get folderName(): string {
        return this._folderName;
    }

    get pathName(): string {
        return this._pathName;
    }

    get remoteURL(): string {
        return this._remoteURL;
    }

    get remoteName(): string {
        return this._remoteName;
    }

    get user(): any {
        return this._user;
    }

    /**
     * Constructor
     * @param configs Configurations imported on application start
     */
    constructor(configs : any){

        //create a folder for the contents from the given path
        this._pathName = configs.repo_conf.local_path;
        this._remoteURL = configs.repo_conf.url;

        if(configs.repo_conf.remote_name !== undefined){
            this._remoteName = configs.repo_conf.remote_name;
        }

        //initialize a repository if it does not exist
        this.initialize(function(event : any){

            console.log(event);

            this.fetchAll();

            //get index for add/commits
            this._repo.refreshIndex().then(function(indexResult : any){
                this._index = indexResult;
            });
        });
    }

    /**
     * Returns the author and commiter
     * @param author_email
     * @param author_name
     * @param time
     * @param offset
     * @returns {any}
     */
    private sign(author_email : any, author_name : any, time : any, offset : any){
        return NG.Signature.create(author_name, author_email, time, offset);
    }

    /**
     * Initialize the repository and remote
     * @param callback
     */
    private initialize(callback : any){
        NG.Repository.init(this._pathName, false).then(function( repository : any) {

            console.log("Repo init : "+repository);

            // Use repository
            this._repo = repository;

            //create the remote
            this._remote = NG.Remote.create(repository, this._remoteName, this._remoteURL);

            callback("Repository Initialized");
        });
    }

    /**
     *
     * @param data Data for specific git events like commit/ author timestamps
     * @param action Action for modifying the files on the index
     * @param msg Commit Message to Print
     * @param person Author name and email for this commit
     * @param tags
     */
    public commit(data : any,action : any, msg : string, person: any, tags : any){
        //get index for add/commits
        this._repo.refreshIndex()
            .then(function(indexResult : any){
                this._index = indexResult;
            })
            .then(function(){
                return action;
            })
            .then(function(){
            //write the files to the index
            return this._index.write();
            })
            .then(function(){
                return this._index.writeTree();
            })
            .then(function(oidResult : any){
                this._oid = oidResult;
                return NG.Reference.nameToId(this._repo, "HEAD");
            })
            .then(function(head : any){
                return this._repo.getCommit(head);
                //return the commit to push to master
            })
            .then(function(parent : any){
                let committer = this.sign(person.email, person.name, data.auditTime, -300);
                let author = this.sign(person.email, person.name, data.eventTime, -300);

                return this._repo.createCommit(
                    "HEAD",
                    author,
                    committer,
                    msg,
                    this._oid,
                    [parent]
                );
            })
            .done(function(commitId : any){
                //commit finished
                console.log("New Commit:", commitId);

                return commitId;
            })
    }

    /**
     * Pushes any changes that have been committed to the remote repository
     */
    public pushToRepo(){
        return this._remote.push(
            ["refs/heads/master:refs/heads/master"],
            {
                callbacks: {
                    credentials: function(url : any, userName : any, password:any){
                        this.auth(userName, password);
                    }
                }
            }
        )
    }

    /**
     * Remove file from the repository
     * @param filepath The path to the file to remove
     * @returns {number}
     */
    public remove(filepath : string){
        return this._index.removeByPath(filepath);
    }

    /**
     * Adds the changes made in the repository
     * @param filepath If only adding a single file
     * @returns {number}
     */
    public add(filepath : string){
        return this._index.addByPath(filepath || this._pathName);
    }

    /**
     * Handle authentication through git/gitlab
     */
    public static auth(username : any, pass: any){
        return NG.Cred.userpassPlaintextNew(username, pass);
    }

    public fetchAll(){
        return this._repo.fetch("origin", {
            callbacks: {
                credentials: function(url : any, userName : any, password:any) {
                    this.auth(userName, password);
                }
            }
        });
    }

}

export = StorageDir;
