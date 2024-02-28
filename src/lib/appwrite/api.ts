import { ID, Query } from 'appwrite';

import { IUpdatePost, INewPost, INewUser, IUpdateUser } from '@/types/indeis';
import { account, appwriteConfig, avatars, storage, databases } from './config';

export async function createUserAccount(user: INewUser) {
    try {
        const newAccount = await account.create(
            ID.unique(),
            user.email,
            user.password,
            user.name
        );
        if (!newAccount) throw Error;

        const avatarUrl = avatars.getInitials(user.name);
        console.log(newAccount)
        const newUser = await saveUserToDB({
            accountid: newAccount.$id,
            name: newAccount.name,
            email: newAccount.email,
            username: user.username,
            imageurl: avatarUrl,
        });

        return newUser;
    } catch (error) {
        console.log(error);
        return error;
    }
}

export async function saveUserToDB(user: {
    accountid: string;
    email: string;
    name: string;
    imageurl: URL;
    username?: string;
}) {

    try {
        const newUser = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            ID.unique(),
            user,
        );

        return newUser;
    } catch (error) {
        console.log(error);
    }
}


export async function signInAccount(user: { email: string; password: string; }) {
    try {
        const session = await account.createEmailSession(user.email, user.password);

        return session;

    } catch (error) {
        console.log(error)
    }
}


export async function getAccount() {
    try {
        const currentAccount = await account.get();

        return currentAccount;
    } catch (error) {
        console.log(error)
    }
}
export async function getCurrentUser() {
    try {
        const currentAccount = await getAccount();
        // console.log(currentAccount)
        if (!currentAccount) throw Error;

        const currentUser = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountid', currentAccount.$id)]
        );
        // console.log(currentUser)
        if (!currentUser) throw Error;


        return currentUser.documents[0];

    } catch (error) {
        console.log(error);
        return error;
    }
}
export async function signOutAccount() {
    try {
        const session = await account.deleteSession("current")

        return session;
    } catch (error) {
        console.log(error);
    }
}
export async function createPost(post: INewPost) {
    console.log("post", post)
    try {
        //Upload image to storage
        const uploadedFile = await uploadFile(post.file[0]);

        if (!uploadedFile) throw Error;

        //Get file url
        // let fileLink = "" 
        const fileUrl = getFilePreview(uploadedFile.$id)
        //console.log(e)
        //console.log(e?.href)
        // return e?.href


        // console.log("fileUrl", fileUrl)
        // console.log("fileLink", fileLink)

        if (!fileUrl) {
            await deleteFile(uploadedFile.$id)
            throw Error;
        }

        //Convert tags in an array
        const tags = post.tags?.replace(/ /g, "").split(",") || [];

        //Save post to database

        const newPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            ID.unique(),
            {
                users: post.userId,
                caption: post.caption,
                imageURL: fileUrl,
                imageid: uploadedFile.$id,
                location: post.location,
                tags: tags,
            }

        )

        if (!newPost) {
            await deleteFile(uploadedFile.$id)
            throw Error
        }
        return newPost;
    } catch (error) {
        console.log(error);
    }

}
export async function uploadFile(file: File) {
    try {

        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file
        );
        return uploadedFile;

    } catch (error) {
        console.log(error);
    }

}
export function getFilePreview(fileId: string) {
    try {
        const fileUrl = storage.getFilePreview(
            appwriteConfig.storageId,
            fileId,
            2000,
            2000,
            "top",
            100,
        )
        //console.log(fileUrl.url)
        return fileUrl;
    } catch (error) {
        console.log(error)
    }
}

export async function deleteFile(fileId: string) {
    try {
        await storage.deleteFile(appwriteConfig.storageId, fileId);

        return { status: 'ok' }
    } catch (error) {
        console.log(error)
    }
}

export async function getRecentPosts() {
    const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        [Query.orderDesc('created_at'), Query.limit(20)]

    )
    if (!posts) throw Error;

    return posts;
}

export async function likePost(postId: string, likesArray: string[]) {

    try {
        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
            {
                likes: likesArray
            }
        )
        if (!updatedPost) throw Error;

        return updatedPost
    } catch (error) {
        console.log(error)
    }
}
export async function savePost(postId: string, userId: string) {

    try {
        const updatedPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            ID.unique(),
            {
                users: userId,
                posts: postId,
            }
        );
        if (!updatedPost) throw Error;

        return updatedPost
    } catch (error) {
        console.log(error)
    }
}
export async function deleteSavedPost(savedRecordId: string, userId: string) {
    
    try {
        const post = await getSavedPostById(savedRecordId, userId)
        console.log(post)
        if(post.total > 0) {
            const statusCode = await databases.deleteDocument(
                appwriteConfig.databaseId,
                appwriteConfig.savesCollectionId,
                post.documents[0].$id,
    
                
            )
            if (!statusCode) throw Error;
        }
        

        return { status: 'ok' }
    } catch (error) {
        console.log(error)
    }
}


export async function getSavedPostById(postId: string, userId: string) {
    const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.savesCollectionId,
        [Query.equal("posts",postId), Query.equal("users", userId)]
        // postId
    )
    if (!posts) throw Error;

    return posts;
}


export async function getPostById(postId: string) {
    try {
        const post = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        )
        return post;
    } catch (error) {
        console.log(error)
    }
}

export async function updatePost(post: IUpdatePost) {
    const hasFileToUpdate = post.file.length > 0;

    try {
        let image ={
            imageURL: post.imageUrl,
            imageId: post.imageId,
        }
        //Upload image to storage
        if(hasFileToUpdate) {
            const uploadedFile = await uploadFile(post.file[0]);

        if (!uploadedFile) throw Error;

        const fileUrl = getFilePreview(uploadedFile.$id)

        if (!fileUrl) {
            await deleteFile(uploadedFile.$id)
            throw Error;
        }

        image = { ...image, imageURL: fileUrl, imageId: uploadedFile.$id}
        }
        
        //Get file url
        // let fileLink = "" 
      
        //console.log(e)
        //console.log(e?.href)
        // return e?.href


        // console.log("fileUrl", fileUrl)
        // console.log("fileLink", fileLink)

     

        //Convert tags in an array
        const tags = post.tags?.replace(/ /g, "").split(",") || [];

        //Save post to database

        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            post.postId,
            {
                caption: post.caption,
                imageURL: image.imageURL,
                imageid: image.imageId,
                location: post.location,
                tags: tags,
            }

        )

        if (!updatedPost) {
            await deleteFile(post.imageId)
            throw Error
        }
        return updatedPost;
    } catch (error) {
        console.log(error);
    }

}

export async function deletePost(postId: string, imageId: string) {
    if(!postId || imageId) throw Error;

    try {
        await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        )
        return { status: 'ok' }
        
    } catch (error) {
        console.log(Error)
    }
}

export async function getInfinitePosts({ pageParam }: { pageParam: number}) {
    const queries: any[] = [Query.orderDesc('$updatedAt'), Query.limit (10)]

    if(pageParam) {
        queries.push(Query.cursorAfter(pageParam.toString()));

    }
    try {
        
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            queries
        )
        if(!posts) throw Error;
        return posts;
    } catch (error) {
        console.log(error)
    }
}
export async function searchPosts( searchTerm: string ) {


    try {
        
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            [Query.search('caption', searchTerm)]
        )
        if(!posts) throw Error;
        return posts;
    } catch (error) {
        console.log(error)
    }
}